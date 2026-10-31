"""Tests for the PostgresWriter upsert logic (uses SQLite in-memory)."""

from app.models import Game, PlayerGameStat, Team
from data_pipeline.store.postgres_writer import PostgresWriter

TEAM_A = {
    "nba_id": 1610612738,
    "name": "Boston Celtics",
    "abbr": "BOS",
    "city": "Boston",
    "conference": "East",
    "division": "Atlantic",
}
TEAM_B = {
    "nba_id": 1610612752,
    "name": "New York Knicks",
    "abbr": "NYK",
    "city": "New York",
    "conference": "East",
    "division": "Atlantic",
}

GAME = {
    "nba_game_id": "0022300001",
    "season": 2023,
    "game_date": "2023-10-24",
    "status": "final",
    "home_abbr": "BOS",
    "away_abbr": "NYK",
    "home_points": 118,
    "away_points": 110,
}

BOX = {
    "nba_game_id": "0022300001",
    "player_lines": [
        {
            "nba_game_id": "0022300001",
            "team_abbr": "BOS",
            "player_name": "Jayson Tatum",
            "nba_player_id": 1628369,
            "minutes": 36.5,
            "points": 30,
            "rebounds": 8,
            "assists": 4,
            "steals": 1,
            "blocks": 0,
            "turnovers": 2,
            "personal_fouls": 3,
            "fg_made": 11,
            "fg_att": 20,
            "fg3_made": 4,
            "fg3_att": 8,
            "ft_made": 4,
            "ft_att": 5,
        }
    ],
}


def test_upsert_teams_is_idempotent(db_session):
    writer = PostgresWriter(db_session)
    first = writer.upsert_teams([TEAM_A, TEAM_B])
    db_session.commit()
    second = writer.upsert_teams([TEAM_A, TEAM_B])
    db_session.commit()

    assert first.created == 2
    assert second.created == 0 and second.updated == 0
    assert db_session.query(Team).count() == 2


def test_upsert_teams_updates_changed_fields(db_session):
    writer = PostgresWriter(db_session)
    writer.upsert_teams([TEAM_A])
    db_session.commit()

    modified = dict(TEAM_A)
    modified["city"] = "Beantown"
    summary = writer.upsert_teams([modified])
    db_session.commit()

    assert summary.updated == 1
    team = db_session.query(Team).filter_by(nba_id=TEAM_A["nba_id"]).one()
    assert team.city == "Beantown"


def test_upsert_games_and_box_scores(db_session):
    writer = PostgresWriter(db_session)
    writer.upsert_teams([TEAM_A, TEAM_B])
    games = writer.upsert_games([GAME])
    db_session.commit()

    assert games.created == 1
    game = db_session.query(Game).filter_by(nba_game_id="0022300001").one()
    assert game.home_points == 118
    assert game.away_points == 110

    # Player before box score upsert finds the parent game by nba_game_id.
    box = writer.upsert_box_scores([BOX])
    db_session.commit()
    assert box.created == 1
    stat = db_session.query(PlayerGameStat).filter_by(nba_player_id=1628369).one()
    assert stat.points == 30
    assert stat.team_id == game.home_team_id


def test_rerun_is_idempotent(db_session):
    writer = PostgresWriter(db_session)
    writer.upsert_teams([TEAM_A, TEAM_B])
    db_session.commit()
    writer.upsert_games([GAME])
    db_session.commit()
    writer.upsert_box_scores([BOX])
    db_session.commit()

    second = writer.upsert_games([GAME])
    db_session.commit()
    third = writer.upsert_box_scores([BOX])
    db_session.commit()

    assert second.created == 0
    assert third.created == 0
    assert db_session.query(Game).count() == 1
    assert db_session.query(PlayerGameStat).count() == 1
