"""End-to-end tests for :func:`build_dataset` against an in-memory DB."""

from __future__ import annotations

from datetime import date

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

    games = [
        # (nba_id, date, home, away, home_pts, away_pts)
        ("G1", date(2023, 10, 1), a, b, 100, 90),
        ("G2", date(2023, 10, 2), b, c, 95, 88),
        ("G3", date(2023, 10, 3), c, a, 102, 80),
        ("G4", date(2023, 10, 5), a, c, 88, 90),
        ("G5", date(2023, 10, 7), b, a, 80, 70),
        ("G6", date(2023, 10, 9), c, b, 95, 85),
    ]
    ids = {}
    for nba_id, d, h, away, hp, ap in games:
        g = Game(
            nba_game_id=nba_id, season=2023, game_date=d, status="final",
            home_team_id=h, away_team_id=away, home_points=hp, away_points=ap,
        )
        db_session.add(g)
        db_session.flush()
        ids[nba_id] = g.id
    db_session.commit()
    return db_session, ids, {"a": a, "b": b, "c": c}


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
    db_session.commit()

    ds = build_dataset(db_session)
    present = [c for c in BOX_METRIC_COLUMNS if c in ds.df.columns]
    assert set(present) == set(BOX_METRIC_COLUMNS)

    # A later game (G6) has no box data, but its home team (c) has prior box
    # games (G2, G3) -> trailing box features are populated, not NaN.
    g6 = ds.df[ds.df["nba_game_id"] == "G6"].iloc[0]
    assert pd.notna(g6["home_roll_efg"])
    assert pd.notna(g6["home_roll_ts"])


def test_build_dataset_box_metrics_do_not_leak_own_game(db_session) -> None:
    _, ids, teams = _seed(db_session)
    # Box data ONLY on the final game itself.
    _add_box(db_session, ids, "G6", teams["c"], 150, 55, 80, 20, 30, 20, 24)
    _add_box(db_session, ids, "G6", teams["b"], 85, 30, 70, 8, 22, 17, 20)
    db_session.commit()

    ds = build_dataset(db_session)
    # Neither team had a prior box game, so G6's rolling box features are NaN —
    # its own box score NEVER leaks into its own features.
    g6 = ds.df[ds.df["nba_game_id"] == "G6"].iloc[0]
    assert g6["home_roll_efg"] != g6["home_roll_efg"]  # NaN (self-compare)
    assert g6["away_roll_efg"] != g6["away_roll_efg"]  # NaN


def test_build_dataset_filters_by_season(db_session) -> None:
    _, _, _ = _seed(db_session)
    ds = build_dataset(db_session, seasons=[2023])
    assert not ds.df.empty
    assert (ds.df["season"] == 2023).all()
    empty = build_dataset(db_session, seasons=[1999])
    assert empty.df.empty
