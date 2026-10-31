"""Team rolling-form features computed with zero target leakage.

The rolling window for a given game uses only games that happened *before*
it (via a shift), so a game's own result never leaks into its features.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd

#: Columns that come back from :func:`team_rolling`.
_ROLL_COLUMNS = ("roll_pts_for", "roll_pts_against", "roll_margin", "roll_win_rate")


def team_rolling(team_games: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    """Add a team's last-``window`` game averages to a per-team game frame.

    Expects ``team_games`` sorted time-irrelevantly with numeric columns
    ``pts_for``, ``pts_against`` and ``win`` (1/0). Adds:

    * ``roll_pts_for`` / ``roll_pts_against`` — average points scored/allowed
    * ``roll_margin`` — average point differential
    * ``roll_win_rate`` — share of games won in the window

    All are lagged by one game (``shift(1)``) so the most recent prior stretch
    is used, never the game itself. Early season games with little history
    produce NaN and are excluded downstream.
    """
    out = team_games.sort_values("game_date").copy()
    for src, dst in (("pts_for", "roll_pts_for"), ("pts_against", "roll_pts_against")):
        out[dst] = out[src].shift(1).rolling(window, min_periods=1).mean()

    margin = (out["pts_for"] - out["pts_against"]).shift(1)
    out["roll_margin"] = margin.rolling(window, min_periods=1).mean()
    out["roll_win_rate"] = out["win"].shift(1).rolling(window, min_periods=1).mean()
    return out
