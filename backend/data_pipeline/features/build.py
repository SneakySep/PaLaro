"""Assemble a supervised training dataset from the PaLaro database.

Loads final games (and any backfilled box-score stats), derives team rolling
form, schedule context, and optional advanced metrics for both the home and
away side of every game, and combines them into one row per game with the
``home_win`` target.
"""

from __future__ import annotations

from typing import NamedTuple

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Game, PlayerGameStat
from data_pipeline.features.advanced_metrics import team_box_metrics, team_rolling_box
from data_pipeline.features.context import team_context
from data_pipeline.features.rolling import team_rolling
from data_pipeline.features.schemas import (
    BOX_METRIC_COLUMNS,
    FEATURE_COLUMNS,
    TARGET_COLUMN,
)


class Dataset(NamedTuple):
    """The supervised matrix handed to the trainer."""

    df: pd.DataFrame
    feature_columns: list[str]
    target_column: str


def _load_games(session: Session, seasons: list[int] | None) -> pd.DataFrame:
    stmt = select(Game).where(Game.status == "final")
    if seasons:
        stmt = stmt.where(Game.season.in_(seasons))
    games = session.execute(stmt.order_by(Game.game_date, Game.id)).scalars().all()
    return pd.DataFrame(
        [
            {
                "id": g.id,
                "game_id": g.id,
                "nba_game_id": g.nba_game_id,
                "season": g.season,
                "game_date": g.game_date,
                "home_team_id": g.home_team_id,
                "away_team_id": g.away_team_id,
                "home_points": g.home_points,
                "away_points": g.away_points,
            }
            for g in games
        ]
    )


def _team_appearances(games: pd.DataFrame) -> pd.DataFrame:
    """One row per team-per-game with that team's own result context."""
    home = games.rename(
        columns={
            "home_team_id": "team_id",
            "home_points": "pts_for",
            "away_points": "pts_against",
        }
    )
    away = games.rename(
        columns={
            "away_team_id": "team_id",
            "away_points": "pts_for",
            "home_points": "pts_against",
        }
    )
    app = pd.concat([home, away], ignore_index=True)
    app["win"] = (app["pts_for"] > app["pts_against"]).astype(int)
    return app[["game_id", "team_id", "game_date", "pts_for", "pts_against", "win"]]


def _team_features(appearances: pd.DataFrame, window: int) -> pd.DataFrame:
    parts: list[pd.DataFrame] = []
    for _, group in appearances.groupby("team_id"):
        parts.append(team_rolling(team_context(group), window))
    return pd.concat(parts, ignore_index=True)


def build_dataset(
    session: Session,
    seasons: list[int] | None = None,
    window: int = 5,
) -> Dataset:
    """Build one feature row per final game.

    ``seasons`` filters to specific season years (e.g. ``[2023]``); by default
    all final games in the DB are used. Rows with too little history to form a
    rolling window are dropped so the model never sees half-formed features.
    """
    games = _load_games(session, seasons)
    if games.empty:
        return Dataset(games, list(FEATURE_COLUMNS), TARGET_COLUMN)

    df = games.assign(
        home_win=(games["home_points"] > games["away_points"]).astype(int),
        home_margin=games["home_points"] - games["away_points"],
    )

    # -- team rolling + context, window per team --
    te = _team_features(_team_appearances(games), window)
    for side, team_col in (("home", "home_team_id"), ("away", "away_team_id")):
        side_feats = te.rename(columns={"game_id": "_game_id", "team_id": team_col})
        side_feats = side_feats.rename(
            columns={
                f"roll_{c}": f"{side}_roll_{c}"
                for c in ("pts_for", "pts_against", "margin", "win_rate")
            }
        )
        side_feats = side_feats.rename(
            columns={"rest_days": f"{side}_rest_days", "b2b": f"{side}_b2b"}
        )
        # game_date is only needed for per-team ordering, done inside the helpers.
        side_feats = side_feats.drop(columns=["game_date", "game_id"], errors="ignore")
        df = df.merge(
            side_feats,
            how="left",
            left_on=["id", team_col],
            right_on=["_game_id", team_col],
        )
        df = df.drop(columns=["_game_id"])

    # -- advanced rolling box metrics from backfilled box scores (no leakage) --
    has_stats = session.execute(
        select(PlayerGameStat.id).where(
            PlayerGameStat.game_id.in_(games["id"].tolist())
        ).limit(1)
    ).scalar()
    if has_stats:
        stats = pd.read_sql(
            select(PlayerGameStat).where(
                PlayerGameStat.game_id.in_(games["id"].tolist())
            ),
            session.bind,
        )
        box_metrics = team_box_metrics(stats)
        # Every team appearance (not just games with their own box score), so a
        # game still gets trailing box features from its team's prior games.
        appearances = pd.concat(
            [
                games[["id", "home_team_id", "game_date"]].rename(
                    columns={"id": "game_id", "home_team_id": "team_id"}
                ),
                games[["id", "away_team_id", "game_date"]].rename(
                    columns={"id": "game_id", "away_team_id": "team_id"}
                ),
            ],
            ignore_index=True,
        )
        rolling_box = team_rolling_box(box_metrics, appearances, window)
        # game_date is only needed for per-team ordering inside team_rolling_box.
        rolling_box = rolling_box.drop(columns=["game_date"], errors="ignore")
        for side, team_col in (("home", "home_team_id"), ("away", "away_team_id")):
            m = rolling_box.rename(columns={"game_id": "_game_id", "team_id": team_col})
            m = m.rename(
                columns={
                    f"roll_{c}": f"{side}_roll_{c}"
                    for c in ("efg", "ts", "ast", "tov", "reb")
                }
            )
            df = df.merge(
                m, how="left", left_on=["id", team_col],
                right_on=["_game_id", team_col],
            )
            df = df.drop(columns=["_game_id"])

    # -- derived cross features --
    df["off_off"] = df["home_roll_pts_for"] - df["away_roll_pts_against"]
    df["def_def"] = df["home_roll_pts_against"] - df["away_roll_pts_for"]
    df["rest_advantage"] = df["home_rest_days"] - df["away_rest_days"]

    # -- drop games without enough history for a rolling window (no leakage) --
    df = df.dropna(subset=["home_roll_pts_for", "away_roll_pts_for"])

    feature_cols = list(FEATURE_COLUMNS)
    feature_cols.extend(c for c in BOX_METRIC_COLUMNS if c in df.columns)

    keep = [
        "id",
        "nba_game_id",
        "season",
        "game_date",
        "home_margin",
        *feature_cols,
        TARGET_COLUMN,
    ]
    return Dataset(df[keep].reset_index(drop=True), feature_cols, TARGET_COLUMN)

