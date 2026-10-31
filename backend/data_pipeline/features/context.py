"""Schedule-context features: rest advantage and back-to-back detection.

``rest_days`` is the number of calendar days since a team's previous game.
A value of 1 means the team played yesterday — a back-to-back.
"""

from __future__ import annotations

import pandas as pd


def team_context(team_games: pd.DataFrame) -> pd.DataFrame:
    """Add ``rest_days`` and ``b2b`` to a per-team game frame.

    Expects a ``game_date`` (datetime-ish) column. ``rest_days`` is NaN for a
    team's first game of the season; ``b2b`` is 1 when the previous game was
    the prior calendar day (and 0 otherwise).
    """
    out = team_games.sort_values("game_date").copy()
    out["game_date"] = pd.to_datetime(out["game_date"])
    prev = out["game_date"].shift(1)
    out["rest_days"] = (out["game_date"] - prev).dt.days
    out["b2b"] = (out["rest_days"] == 1).astype(float)
    return out
