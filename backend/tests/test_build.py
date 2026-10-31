"""End-to-end tests for :func:`build_dataset` against an in-memory DB."""

from __future__ import annotations

from datetime import date

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
    return db_session, ids


def _seed_box_stats(db_session, ids):
    # Box stats for the last game (both teams) so metrics columns populate.
    rows = [
        (ids["G6"], 3, 15, 5, 10, 2, 5, 3, 4),
        (ids["G6"], 2, 11, 4, 8, 1, 3, 2, 2),
    ]
    for game_id, team_id, pts, fgm, fga, fg3m, fg3a, ftm, fta in rows:
        db_session.add(
            PlayerGameStat(
                game_id=game_id, team_id=team_id, player_name="p", nba_player_id=99,
                minutes=20.0, points=pts, rebounds=3, assists=3, steals=1,
                blocks=1, turnovers=1, personal_fouls=2,
                fg_made=fgm, fg_att=fga, fg3_made=fg3m, fg3_att=fg3a,
                ft_made=ftm, ft_att=fta,
            )
        )
    db_session.commit()


def test_build_dataset_shape_and_target(db_session) -> None:
    _, _ = _seed(db_session)
    ds = build_dataset(db_session)

    assert not ds.df.empty
    assert TARGET_COLUMN in ds.df.columns
    # Every row's target matches its result and features are fully populated.
    assert (ds.df[TARGET_COLUMN] == (ds.df["home_margin"] > 0).astype(int)).all()
    assert ds.df[FEATURE_COLUMNS].notna().all().all()


def test_build_dataset_feature_columns_contract(db_session) -> None:
    _, _ = _seed(db_session)
    ds = build_dataset(db_session)
    assert set(FEATURE_COLUMNS) <= set(ds.df.columns)
    assert ds.target_column == TARGET_COLUMN


def test_build_dataset_with_box_metrics(db_session) -> None:
    _, ids = _seed(db_session)
    _seed_box_stats(db_session, ids)
    ds = build_dataset(db_session)

    present = [c for c in BOX_METRIC_COLUMNS if c in ds.df.columns]
    assert present, "expected box-metric columns added when stats exist"
    # The box-stats game (G6) should carry non-null home/away metrics.
    g6 = ds.df[ds.df["nba_game_id"] == "G6"].iloc[0]
    assert g6["home_team_efg"] is not None


def test_build_dataset_filters_by_season(db_session) -> None:
    _, _ = _seed(db_session)
    ds = build_dataset(db_session, seasons=[2023])
    assert not ds.df.empty
    assert (ds.df["season"] == 2023).all()
    empty = build_dataset(db_session, seasons=[1999])
    assert empty.df.empty
