"""Tests for advanced per-(game, team) box-score metrics."""

from __future__ import annotations

import pandas as pd

from data_pipeline.features.advanced_metrics import team_box_metrics, team_rolling_box


def _stats() -> pd.DataFrame:
    return pd.DataFrame(
        [
            # game 1, team 1: two players
            {"game_id": 1, "team_id": 10, "points": 15,
             "rebounds": 6, "assists": 5, "turnovers": 2,
             "fg_made": 5, "fg_att": 10, "fg3_made": 2, "fg3_att": 5,
             "ft_made": 3, "ft_att": 4},
            {"game_id": 1, "team_id": 10, "points": 11,
             "rebounds": 4, "assists": 3, "turnovers": 1,
             "fg_made": 4, "fg_att": 8, "fg3_made": 1, "fg3_att": 3,
             "ft_made": 2, "ft_att": 2},
            # game 1, team 2: all zeros -> guards against div-by-zero
            {"game_id": 1, "team_id": 11, "points": 0,
             "rebounds": 0, "assists": 0, "turnovers": 0,
             "fg_made": 0, "fg_att": 0, "fg3_made": 0, "fg3_att": 0,
             "ft_made": 0, "ft_att": 0},
        ]
    )


def test_team_efg_and_ts_on_totals() -> None:
    out = team_box_metrics(_stats())
    assert len(out) == 2

    team1 = out[out["team_id"] == 10].iloc[0]
    # efg = (9 + 0.5*3) / 18
    assert round(team1["team_efg"], 4) == round((9 + 0.5 * 3) / 18, 4)
    # ts = 26 / (2*(18 + 0.44*6))
    assert round(team1["team_ts"], 4) == round(26 / (2 * (18 + 0.44 * 6)), 4)
    assert team1["team_pts"] == 26
    assert team1["team_ast"] == 8
    assert team1["team_tov"] == 3
    assert team1["team_reb"] == 10


def test_zero_attempts_do_not_divide() -> None:
    out = team_box_metrics(_stats())
    team2 = out[out["team_id"] == 11].iloc[0]
    assert pd.isna(team2["team_efg"])
    assert pd.isna(team2["team_ts"])


def test_team_rolling_box_never_leaks_own_game() -> None:
    metrics = pd.DataFrame(
        [
            # Team 10 game 1 (feeds game 2's trailing feature).
            {"game_id": 1, "team_id": 10, "team_efg": 0.50, "team_ts": 0.55,
             "team_ast": 10, "team_tov": 5, "team_reb": 40},
            # Team 10 game 2 (its own metrics must NOT appear in its features).
            {"game_id": 2, "team_id": 10, "team_efg": 0.90, "team_ts": 0.95,
             "team_ast": 30, "team_tov": 1, "team_reb": 60},
            # A different team in the same games, to exercise the groupby/shift.
            {"game_id": 1, "team_id": 11, "team_efg": 0.40, "team_ts": 0.45,
             "team_ast": 8, "team_tov": 6, "team_reb": 38},
        ]
    )
    appearances = pd.DataFrame(
        [
            {"game_id": 1, "team_id": 10, "game_date": "2023-10-01"},
            {"game_id": 2, "team_id": 10, "game_date": "2023-10-05"},
            {"game_id": 1, "team_id": 11, "game_date": "2023-10-01"},
        ]
    )
    out = team_rolling_box(metrics, appearances, window=5).set_index(
        ["game_id", "team_id"]
    )

    # Game 1 has no prior game -> NaN trailing features.
    assert pd.isna(out.loc[(1, 10), "roll_efg"])
    # Game 2's trailing efg/ts come from game 1's box metrics, NOT its own (0.90).
    assert out.loc[(2, 10), "roll_efg"] == 0.50
    assert out.loc[(2, 10), "roll_ts"] == 0.55
    assert out.loc[(2, 10), "roll_ast"] == 10
    assert out.loc[(2, 10), "roll_tov"] == 5
