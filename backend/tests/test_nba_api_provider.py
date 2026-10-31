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
        "TOV": 3,
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


def test_convert_line_skips_blank_stats():
    provider = NBA_APIProvider(use_sleep=False)
    raw = {"PLAYER_ID": 999, "PLAYER_NAME": "X", "PTS": "", "REB": "",
           "team_abbr": "BOS"}
    line = provider._convert_line("0022300002", raw)
    assert line["points"] is None
    assert line["rebounds"] is None
