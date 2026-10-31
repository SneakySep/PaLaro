"""Canonical feature/target column names for the supervised training set.

Keeping these in one module means the trainer, prediction server, and the
feature builder all agree on the exact column names — no drift between what
we train on and what we serve predictions from.
"""

from __future__ import annotations

#: Numeric feature columns produced by :mod:`data_pipeline.features.build`.
#: These are the columns the first XGBoost model is trained on.
FEATURE_COLUMNS: list[str] = [
    # Team rolling form (last N games, zero-leakage via shift).
    "home_roll_pts_for",
    "home_roll_pts_against",
    "home_roll_margin",
    "home_roll_win_rate",
    "away_roll_pts_for",
    "away_roll_pts_against",
    "away_roll_margin",
    "away_roll_win_rate",
    # Head-to-head point-expectation deltas.
    "off_off",   # home offense vs away defense (pts_for diff)
    "def_def",   # home defense vs away offense (pts_against diff)
    # Schedule context.
    "home_rest_days",
    "away_rest_days",
    "rest_advantage",
    "home_b2b",
    "away_b2b",
]

#: Optional advanced per-game team metrics derived from box-score data.
#: Included in the dataset only when the corresponding player stats exist.
BOX_METRIC_COLUMNS: list[str] = [
    "home_team_efg",
    "home_team_ts",
    "home_team_ast",
    "home_team_tov",
    "home_team_reb",
    "away_team_efg",
    "away_team_ts",
    "away_team_ast",
    "away_team_tov",
    "away_team_reb",
]

#: The supervised target: 1 when the home team won, else 0.
TARGET_COLUMN: str = "home_win"
