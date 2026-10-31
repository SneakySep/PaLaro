"""Tests for rolling-form feature builder (zero-leakage rolling averages)."""

from __future__ import annotations

import pandas as pd
import pytest

from data_pipeline.features.rolling import team_rolling


def _frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "game_date": pd.to_datetime(
                ["2023-10-01", "2023-10-03", "2023-10-05", "2023-10-07", "2023-10-09"]
            ),
            "pts_for": [100, 80, 110, 70, 105],
            "pts_against": [90, 95, 100, 88, 80],
            "win": [1, 0, 1, 0, 1],
        }
    )


def test_first_game_has_no_history() -> None:
    out = team_rolling(_frame(), window=3)
    assert pd.isna(out.loc[0, "roll_pts_for"])
    assert pd.isna(out.loc[0, "roll_win_rate"])


def test_rolling_uses_only_prior_games() -> None:
    """Window=3 at row 3 uses rows 0..2 only (no leakage of the current game)."""
    out = team_rolling(_frame(), window=3)
    row = out.loc[3]
    assert row["roll_pts_for"] == pytest.approx((100 + 80 + 110) / 3)
    assert row["roll_pts_against"] == pytest.approx((90 + 95 + 100) / 3)
    assert row["roll_margin"] == pytest.approx((10 + (-15) + 10) / 3)
    assert row["roll_win_rate"] == pytest.approx(2 / 3)


def test_partial_history_early_but_full_later() -> None:
    out = team_rolling(_frame(), window=3)
    # row 2 has only 2 prior games (rows 0,1)
    assert out.loc[2, "roll_pts_for"] == pytest.approx((100 + 80) / 2)
    # row 4 uses rows 1,2,3
    assert out.loc[4, "roll_pts_for"] == pytest.approx((80 + 110 + 70) / 3)
