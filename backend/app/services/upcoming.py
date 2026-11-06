"""Upcoming-game predictions: compute features for scheduled games and score them.

Bridges the data pipeline and the prediction service. Given the final games in
the DB, each team's *current* rolling form and schedule context are computed
with the same zero-leakage helpers used at training time (a team's most recent
game contributes nothing to its own features). Scheduled games are then scored
with the persisted :class:`ModelArtifact` through :func:`predict`, so the
request validation, feature alignment, and confidence interval all match the
single-game ``POST /predict`` path exactly.
"""

from __future__ import annotations

import logging
import math
from datetime import date, timedelta

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Game
from app.services.predictor import (
    FeatureMismatchError,
    PredictionResponse,
    PredictRequest,
    get_artifact,
    predict,
)
from data_pipeline.features.advanced_metrics import team_box_metrics, team_rolling_box
from data_pipeline.features.build import (
    load_box_stats,
    load_final_games,
    team_appearances,
)
from data_pipeline.features.context import team_context
from data_pipeline.features.rolling import team_rolling

logger = logging.getLogger(__name__)

#: A team whose most recent final game is older than this is treated as having
#: no usable current form. Training data only ever contains 1-9 rest days; a
#: value in the hundreds (stale DB, new season not yet ingested) is far outside
#: the model's distribution and would produce confident nonsense.
MAX_REST_DAYS = 30


class UpcomingPrediction(PredictionResponse):
    """A prediction for a scheduled game, plus its tip-off date."""

    game_date: date


def _team_current_form(appearances: pd.DataFrame, window: int) -> pd.DataFrame:
    """Most recent zero-leakage rolling features per team, indexed by ``team_id``.

    One row per team — the rolling row of its latest final game — carrying
    ``roll_pts_for/against/margin/win_rate`` and that game's ``game_date``
    (the team's last known game, used to derive upcoming rest days).
    """
    frames = [
        team_rolling(team_context(group), window)
        for _, group in appearances.groupby("team_id")
    ]
    te = pd.concat(frames, ignore_index=True)
    te["game_date"] = pd.to_datetime(te["game_date"])
    latest = te.sort_values("game_date").groupby("team_id", as_index=False).tail(1)
    return latest.set_index("team_id")


def _team_box_form(
    session: Session, games: pd.DataFrame, appearances: pd.DataFrame, window: int
) -> pd.DataFrame:
    """Most recent trailing box metrics per team (empty when no stats exist)."""
    stats = load_box_stats(session, games)
    if stats.empty:
        return pd.DataFrame()
    box_metrics = team_box_metrics(stats)
    rolling_box = team_rolling_box(box_metrics, appearances, window)
    rolling_box["game_date"] = pd.to_datetime(rolling_box["game_date"])
    return (
        rolling_box.sort_values("game_date")
        .groupby("team_id", as_index=False)
        .tail(1)
        .set_index("team_id")
    )


def _features_for_game(
    game: Game,
    form: pd.DataFrame,
    box_form: pd.DataFrame,
    box_columns: list[str],
    required_columns: list[str],
) -> dict[str, float] | None:
    """Assemble the trained model's feature vector for one scheduled game.

    Returns ``None`` (with a warning logged) when the game cannot be scored:
    either side lacks enough history, or a required feature is missing/NaN.
    """
    try:
        home = form.loc[game.home_team_id]
        away = form.loc[game.away_team_id]
    except KeyError:
        logger.warning(
            "skip game %s: insufficient game history for a team", game.nba_game_id
        )
        return None

    home_rest = (pd.Timestamp(game.game_date) - home["game_date"]).days
    away_rest = (pd.Timestamp(game.game_date) - away["game_date"]).days
    if home_rest <= 0 or away_rest <= 0:
        # The slate predates (or equals) a team's last known final game —
        # history is stale or misordered; refuse to fabricate features.
        logger.warning(
            "skip game %s: non-positive rest days (home=%s, away=%s)",
            game.nba_game_id,
            home_rest,
            away_rest,
        )
        return None
    if home_rest > MAX_REST_DAYS or away_rest > MAX_REST_DAYS:
        # The team's last final game is too far in the past to describe its
        # current form — almost always a season that was never ingested.
        # Scoring anyway feeds the model an out-of-distribution rest value.
        logger.warning(
            "skip game %s: stale team form (home_rest=%s, away_rest=%s, max=%s); "
            "ingest the current season's results",
            game.nba_game_id,
            home_rest,
            away_rest,
            MAX_REST_DAYS,
        )
        return None

    features: dict[str, float | None] = {
        "home_roll_pts_for": float(home["roll_pts_for"]),
        "home_roll_pts_against": float(home["roll_pts_against"]),
        "home_roll_margin": float(home["roll_margin"]),
        "home_roll_win_rate": float(home["roll_win_rate"]),
        "away_roll_pts_for": float(away["roll_pts_for"]),
        "away_roll_pts_against": float(away["roll_pts_against"]),
        "away_roll_margin": float(away["roll_margin"]),
        "away_roll_win_rate": float(away["roll_win_rate"]),
        # Same cross-feature formulas as training (data_pipeline.features.build).
        "off_off": float(home["roll_pts_for"]) - float(away["roll_pts_against"]),
        "def_def": float(home["roll_pts_against"]) - float(away["roll_pts_for"]),
        "home_rest_days": float(home_rest),
        "away_rest_days": float(away_rest),
        "rest_advantage": float(home_rest - away_rest),
        "home_b2b": float(home_rest == 1),
        "away_b2b": float(away_rest == 1),
    }

    if (
        not box_form.empty
        and game.home_team_id in box_form.index
        and game.away_team_id in box_form.index
    ):
        for side, team_id in (("home", game.home_team_id), ("away", game.away_team_id)):
            row = box_form.loc[team_id]
            prefix = f"{side}_roll_"
            for col in box_columns:
                # ``box_columns`` holds both sides' columns; only take the ones
                # belonging to this side, otherwise the prefix strip is a no-op
                # and we look up a key like "roll_away_roll_efg".
                if not col.startswith(prefix):
                    continue
                short = col.removeprefix(prefix)  # e.g. "efg"
                features[col] = float(row[f"roll_{short}"])

    payload: dict[str, float] = {}
    nan_cols: list[str] = []
    for col in required_columns:
        val = features.get(col)
        if val is None or math.isnan(val):
            nan_cols.append(col)
        else:
            payload[col] = float(val)
    if nan_cols:
        logger.warning(
            "skip game %s: missing/NaN feature(s) %s",
            game.nba_game_id,
            ", ".join(nan_cols),
        )
        return None
    return payload


def upcoming_predictions(
    session: Session,
    days: int = 7,
    window: int = 5,
    today: date | None = None,
) -> list[UpcomingPrediction]:
    """Score every scheduled game from ``today`` through ``today + days``.

    Games that cannot be scored (insufficient team history, NaN features) are
    skipped with a warning rather than failing the whole slate. Raises
    :class:`ModelNotReadyError` when no artifact exists — callers map that to
    HTTP 503.
    """
    from data_pipeline.features.schemas import BOX_METRIC_COLUMNS

    artifact = get_artifact()
    today = today or date.today()
    horizon_end = today + timedelta(days=days)

    scheduled = (
        session.execute(
            select(Game)
            .options(joinedload(Game.home_team), joinedload(Game.away_team))
            .where(
                Game.status == "scheduled",
                Game.game_date >= today,
                Game.game_date <= horizon_end,
            )
            .order_by(Game.game_date, Game.id)
        )
        .scalars()
        .all()
    )
    if not scheduled:
        return []

    games = load_final_games(session, None)
    if games.empty:
        logger.warning("no final games in the DB; cannot compute team form")
        return []

    appearances = team_appearances(games)
    form = _team_current_form(appearances, window)
    needs_box = any(col in artifact.feature_columns for col in BOX_METRIC_COLUMNS)
    box_form = (
        _team_box_form(session, games, appearances, window) if needs_box else pd.DataFrame()
    )

    results: list[UpcomingPrediction] = []
    for game in scheduled:
        features = _features_for_game(
            game,
            form,
            box_form,
            list(BOX_METRIC_COLUMNS),
            artifact.feature_columns,
        )
        if features is None:
            continue
        request = PredictRequest(
            game_id=game.nba_game_id,
            home_team=game.home_team.abbr,
            away_team=game.away_team.abbr,
            features=features,
        )
        try:
            base = predict(request)
        except FeatureMismatchError as exc:  # pragma: no cover — payload is pre-filtered
            logger.warning("skip game %s: %s", game.nba_game_id, exc)
            continue
        results.append(UpcomingPrediction(**base.model_dump(), game_date=game.game_date))
    return results
