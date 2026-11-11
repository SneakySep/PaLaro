"""Tests for the games and teams read APIs.

These cover the two contracts the dashboard relies on: an ``X-Total-Count``
header for pagination, and a team profile that defaults to the latest season
instead of mixing every season in the database.
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import create_app
from app.models import Game, Team


@pytest.fixture
def client(db_session):
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _seed(db_session) -> None:
    alpha = Team(
        nba_id=1,
        name="Alpha",
        abbr="AAA",
        city="Alpha City",
        conference="East",
        division="Atlantic",
    )
    beta = Team(
        nba_id=2,
        name="Beta",
        abbr="BBB",
        city="Beta City",
        conference="West",
        division="Pacific",
    )
    db_session.add_all([alpha, beta])
    db_session.flush()

    rows = [
        ("G1", 2023, date(2023, 10, 1), "final", 101, 99),
        ("G2", 2023, date(2023, 10, 2), "final", 95, 100),
        ("G3", 2024, date(2024, 10, 1), "final", 110, 100),
        ("G4", 2024, date(2024, 10, 2), "scheduled", None, None),
    ]
    for nba_game_id, season, game_date, status, home_points, away_points in rows:
        db_session.add(
            Game(
                nba_game_id=nba_game_id,
                season=season,
                game_date=game_date,
                status=status,
                home_team_id=alpha.id,
                away_team_id=beta.id,
                home_points=home_points,
                away_points=away_points,
            )
        )
    db_session.commit()


def test_games_pagination_returns_total_header(client, db_session) -> None:
    _seed(db_session)

    first = client.get("/api/v1/games", params={"limit": 2, "offset": 0})
    assert first.status_code == 200
    assert len(first.json()) == 2
    assert first.headers["X-Total-Count"] == "4"

    second = client.get("/api/v1/games", params={"limit": 2, "offset": 2})
    assert second.status_code == 200
    assert len(second.json()) == 2
    assert second.headers["X-Total-Count"] == "4"

    # The two pages do not overlap and together cover the whole result set.
    ids = [g["game_id"] for g in first.json() + second.json()]
    assert sorted(ids) == ["G1", "G2", "G3", "G4"]


def test_games_total_respects_filters(client, db_session) -> None:
    _seed(db_session)

    r = client.get(
        "/api/v1/games",
        params={"status": "final", "team": "AAA", "limit": 1},
    )
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.headers["X-Total-Count"] == "3"

    unknown = client.get("/api/v1/games", params={"team": "ZZZ"})
    assert unknown.status_code == 200
    assert unknown.json() == []
    assert unknown.headers["X-Total-Count"] == "0"


def test_team_detail_defaults_to_latest_season(client, db_session) -> None:
    _seed(db_session)

    r = client.get("/api/v1/teams/AAA")
    assert r.status_code == 200
    body = r.json()
    assert body["season"] == 2024
    assert body["overall"]["games"] == 1
    assert [g["game_id"] for g in body["recent"]] == ["G3"]
    assert [g["game_id"] for g in body["upcoming"]] == ["G4"]


def test_team_detail_can_scope_or_combine_seasons(client, db_session) -> None:
    _seed(db_session)

    scoped = client.get("/api/v1/teams/AAA", params={"season": 2023})
    assert scoped.status_code == 200
    assert scoped.json()["season"] == 2023
    assert scoped.json()["overall"]["games"] == 2

    combined = client.get("/api/v1/teams/AAA", params={"all_seasons": True})
    assert combined.status_code == 200
    assert combined.json()["season"] is None
    assert combined.json()["overall"]["games"] == 3


def test_unknown_team_is_a_clean_404(client) -> None:
    r = client.get("/api/v1/teams/ZZZ")
    assert r.status_code == 404
    assert r.json()["detail"] == "unknown team 'ZZZ'"
