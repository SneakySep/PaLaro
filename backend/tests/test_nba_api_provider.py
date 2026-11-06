"""Unit tests for the nba_api provider's pure helper functions (no network)."""

import pytest

from data_pipeline.ingest.providers.nba_api_provider import (
    NBA_APIProvider,
    _minutes,
)


def test_minutes_parsing():
    assert _minutes("24:35") == pytest.approx(24.58, abs=0.01)
    assert _minutes("24") == 24.0
    assert _minutes("") is None
    assert _minutes(None) is None


def test_game_from_rows_vs_matchup():
    rows = [
        {
            "GAME_ID": "0022300001",
            "GAME_DATE": "2023-10-24T00:00:00",
            "MATCHUP": "BOS vs. NYK",
            "PTS": 118,
        },
        {
            "GAME_ID": "0022300001",
            "GAME_DATE": "2023-10-24T00:00:00",
            "MATCHUP": "NYK @ BOS",
            "PTS": 110,
        },
    ]
    game = NBA_APIProvider._game_from_rows("0022300001", rows, "2023-24")
    assert game["home_abbr"] == "BOS"
    assert game["away_abbr"] == "NYK"
    assert game["home_points"] == 118
    assert game["away_points"] == 110
    assert game["status"] == "final"
    assert game["game_date"] == "2023-10-24"
    assert game["season"] == 2023


def test_game_from_rows_only_away_present():
    rows = [
        {
            "GAME_ID": "0022300002",
            "GAME_DATE": "2023-10-25T00:00:00",
            "MATCHUP": "LAL @ GSW",
            "PTS": 120,
        }
    ]
    game = NBA_APIProvider._game_from_rows("0022300002", rows, "2023-24")
    assert game["home_abbr"] == "GSW"
    assert game["away_abbr"] == "LAL"
    assert game["home_points"] is None
    assert game["away_points"] == 120
    assert game["status"] == "scheduled"


def test_convert_line_full_row():
    provider = NBA_APIProvider(use_sleep=False)
    raw = {
        "PLAYER_NAME": "LeBron James",
        "PLAYER_ID": 2544,
        "TEAM_ID": 1610612747,
        "MIN": "37:11",
        "PTS": 28,
        "REB": 9,
        "AST": 8,
        "STL": 2,
        "BLK": 1,
        "TO": 3,
        "PF": 2,
        "FGM": 10,
        "FGA": 19,
        "FG3M": 2,
        "FG3A": 5,
        "FTM": 6,
        "FTA": 8,
    }
    raw["team_abbr"] = "LAL"
    line = provider._convert_line("0022300002", raw)
    assert line["nba_player_id"] == 2544
    assert line["player_name"] == "LeBron James"
    assert line["points"] == 28
    assert line["fg_att"] == 19
    assert line["minutes"] == pytest.approx(37.18, abs=0.01)
    # Regression: the raw column is "TO", not "TOV". Reading the wrong key
    # produced None for every player and silently zeroed the turnover features.
    assert line["turnovers"] == 3


def test_convert_line_skips_blank_stats():
    provider = NBA_APIProvider(use_sleep=False)
    raw = {"PLAYER_ID": 999, "PLAYER_NAME": "X", "PTS": "", "REB": "",
           "team_abbr": "BOS"}
    line = provider._convert_line("0022300002", raw)
    assert line["points"] is None
    assert line["rebounds"] is None


def test_game_from_scoreboard_item_scheduled():
    item = {
        "gameId": "0022500061",
        "gameStatus": 1,
        "gameStatusText": "7:00 pm ET",
        "homeTeam": {"teamTricode": "PHX", "score": 0},
        "awayTeam": {"teamTricode": "ORL", "score": 0},
    }
    game = NBA_APIProvider._game_from_scoreboard_item(item, "2026-11-05")
    assert game["status"] == "scheduled"
    # Not-started games report score 0 — it must become None, not 0.
    assert game["home_points"] is None
    assert game["away_points"] is None
    assert game["home_abbr"] == "PHX"
    assert game["away_abbr"] == "ORL"
    assert game["season"] == 2026


def test_game_from_scoreboard_item_final():
    item = {
        "gameId": "0022301234",
        "gameStatus": 3,
        "gameStatusText": "Final",
        "homeTeam": {"teamTricode": "BOS", "score": 132},
        "awayTeam": {"teamTricode": "WAS", "score": 122},
    }
    game = NBA_APIProvider._game_from_scoreboard_item(item, "2024-04-14")
    assert game["status"] == "final"
    assert game["home_points"] == 132
    assert game["away_points"] == 122
    # April game → the season that started the previous year (2023-24).
    assert game["season"] == 2023


def test_game_from_scoreboard_item_live():
    item = {
        "gameId": "0022500062",
        "gameStatus": 2,
        "gameStatusText": "Q3",
        "homeTeam": {"teamTricode": "LAL", "score": 71},
        "awayTeam": {"teamTricode": "GSW", "score": 68},
    }
    game = NBA_APIProvider._game_from_scoreboard_item(item, "2026-01-10")
    assert game["status"] == "live"
    assert game["home_points"] == 71
    assert game["away_points"] == 68


def test_season_from_date():
    season_of = NBA_APIProvider._season_from_date
    assert season_of("2023-10-24") == 2023   # October → that year
    assert season_of("2024-04-14") == 2023   # April → previous year's label
    assert season_of("2024-06-30") == 2023   # Finals still 2023-24
    assert season_of("2024-07-01") == 2024   # July → next season begins
    assert season_of("2026-11-05") == 2026
