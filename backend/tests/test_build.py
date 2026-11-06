"""End-to-end tests for :func:`build_dataset` against an in-memory DB."""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from app.models import Game, PlayerGameStat, Team
from data_pipeline.features.build import build_dataset
from data_pipeline.features.schemas import (
    BOX_METRIC_COLUMNS,
    FEATURE_COLUMNS,
    TARGET_COLUMN,
)


def _add_team(session, nba_id: int, abbr: str) -> int:
    t = Team(nba_id=nba_id, name=f"Team {abbr}", abbr=abbr, city="City", conference=None)
    session.add(t)
    session.flush()
    return t.id


def _seed(db_session):
    a = _add_team(db_session, 1, "AAA")
    b = _add_team(db_session, 2, "BBB")
    c = _add_team(db_session, 3, "CCC")
    teams = [a, b, c]

    # 15 games on a round-robin rotation. Every team appears in every game, so
    # by the later games each side has the full 5-game rolling window that the
    # default ``min_periods=window`` requires before a feature row is kept.
    ids = {}
    base = date(2023, 10, 1)
    for k in range(15):
        home, away = teams[k % 3], teams[(k + 1) % 3]
        home_pts, away_pts = (100, 90) if k % 2 == 0 else (90, 100)
        g = Game(
            nba_game_id=f"G{k + 1}", season=2023,
            game_date=base + timedelta(days=k), status="final",
            home_team_id=home, away_team_id=away,
            home_points=home_pts, away_points=away_pts,
        )
        db_session.add(g)
        db_session.flush()
        ids[f"G{k + 1}"] = g.id
    db_session.commit()
    return db_session, ids, {"a": a, "b": b, "c": c}


#: The last seeded game — the one guaranteed to have a full window of history.
_LAST_GAME = "G15"


def _add_box(
    session, ids: dict, game: str, team: int,
    pts: int, fg: int, fga: int, fg3: int, fg3a: int, ft: int, fta: int,
) -> None:
    """Add a single summed player line for a (game, team) pair."""
    session.add(
        PlayerGameStat(
            game_id=ids[game], team_id=team, player_name="p", nba_player_id=99,
            minutes=20.0, points=pts, rebounds=3, assists=3, steals=1,
            blocks=1, turnovers=1, personal_fouls=2,
            fg_made=fg, fg_att=fga, fg3_made=fg3, fg3_att=fg3a,
            ft_made=ft, ft_att=fta,
        )
    )


def test_build_dataset_shape_and_target(db_session) -> None:
    _, _, _ = _seed(db_session)
    ds = build_dataset(db_session)

    assert not ds.df.empty
    assert TARGET_COLUMN in ds.df.columns
    # Every row's target matches its result and features are fully populated.
    assert (ds.df[TARGET_COLUMN] == (ds.df["home_margin"] > 0).astype(int)).all()
    assert ds.df[FEATURE_COLUMNS].notna().all().all()


def test_build_dataset_feature_columns_contract(db_session) -> None:
    _, _, _ = _seed(db_session)
    ds = build_dataset(db_session)
    assert set(FEATURE_COLUMNS) <= set(ds.df.columns)
    assert ds.target_column == TARGET_COLUMN


def test_build_dataset_with_rolling_box_metrics(db_session) -> None:
    _, ids, teams = _seed(db_session)
    # Box stats on G1..G3 so later games get trailing (prior-game) features.
    _add_box(db_session, ids, "G1", teams["a"], 100, 35, 70, 10, 25, 20, 24)
    _add_box(db_session, ids, "G1", teams["b"], 90, 30, 70, 8, 22, 22, 28)
    _add_box(db_session, ids, "G2", teams["b"], 95, 32, 68, 9, 23, 22, 27)
    _add_box(db_session, ids, "G2", teams["c"], 88, 28, 66, 7, 21, 25, 30)
    _add_box(db_session, ids, "G3", teams["c"], 102, 36, 70, 12, 25, 18, 22)
    _add_box(db_session, ids, "G3", teams["a"], 80, 28, 65, 8, 24, 16, 20)
    # Box lines on games close to the end of the run, so the last game's home
    # team (c) still has them inside its trailing 5-appearance window.
    _add_box(db_session, ids, "G11", teams["c"], 98, 34, 72, 11, 26, 19, 23)
    _add_box(db_session, ids, "G12", teams["c"], 104, 37, 71, 13, 27, 17, 21)
    db_session.commit()

    ds = build_dataset(db_session)
    present = [c for c in BOX_METRIC_COLUMNS if c in ds.df.columns]
    assert set(present) == set(BOX_METRIC_COLUMNS)

    # The last game has no box data of its own, but its home team has prior box
    # games (G11, G12) inside the trailing window -> features are populated.
    last = ds.df[ds.df["nba_game_id"] == _LAST_GAME].iloc[0]
    assert pd.notna(last["home_roll_efg"])
    assert pd.notna(last["home_roll_ts"])


def test_build_dataset_box_metrics_do_not_leak_own_game(db_session) -> None:
    _, ids, teams = _seed(db_session)
    # Box data ONLY on the final game itself.
    _add_box(db_session, ids, _LAST_GAME, teams["c"], 150, 55, 80, 20, 30, 20, 24)
    _add_box(db_session, ids, _LAST_GAME, teams["a"], 85, 30, 70, 8, 22, 17, 20)
    db_session.commit()

    ds = build_dataset(db_session)
    # Neither team had a prior box game, so the last game's rolling box features
    # are NaN — its own box score NEVER leaks into its own features.
    last = ds.df[ds.df["nba_game_id"] == _LAST_GAME].iloc[0]
    assert last["home_roll_efg"] != last["home_roll_efg"]  # NaN (self-compare)
    assert last["away_roll_efg"] != last["away_roll_efg"]  # NaN


def test_build_dataset_filters_by_season(db_session) -> None:
    _, _, _ = _seed(db_session)
    ds = build_dataset(db_session, seasons=[2023])
    assert not ds.df.empty
    assert (ds.df["season"] == 2023).all()
    empty = build_dataset(db_session, seasons=[1999])
    assert empty.df.empty
