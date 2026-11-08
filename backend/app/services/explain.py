"""Per-prediction feature attribution for the PaLaro win model.

XGBoost can emit exact tree SHAP values via ``pred_contribs``, so explanations
need no extra dependency. Two details matter for correctness:

* The contributions sum to the model's **log-odds margin**, not to the
  probability. Each one is converted to a probability delta by comparing the
  full prediction against the prediction with that feature's contribution
  removed, which keeps the numbers in the same unit the UI displays.
* The final element of the contribution vector is the bias term, not a feature.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import pandas as pd
import xgboost as xgb

from data_pipeline.training.model import ModelArtifact

#: Human-readable labels and grouping for the engineered feature names.
FEATURE_LABELS: dict[str, tuple[str, str]] = {
    "home_roll_pts_for": ("Home scoring", "form"),
    "home_roll_pts_against": ("Home defense", "form"),
    "home_roll_margin": ("Home point differential", "form"),
    "home_roll_win_rate": ("Home win rate", "form"),
    "away_roll_pts_for": ("Away scoring", "form"),
    "away_roll_pts_against": ("Away defense", "form"),
    "away_roll_margin": ("Away point differential", "form"),
    "away_roll_win_rate": ("Away win rate", "form"),
    "off_off": ("Offense vs defense edge", "matchup"),
    "def_def": ("Defense vs offense edge", "matchup"),
    "home_rest_days": ("Home rest", "schedule"),
    "away_rest_days": ("Away rest", "schedule"),
    "rest_advantage": ("Rest advantage", "schedule"),
    "home_b2b": ("Home back-to-back", "schedule"),
    "away_b2b": ("Away back-to-back", "schedule"),
    "home_roll_efg": ("Home shooting (eFG)", "shooting"),
    "home_roll_ts": ("Home true shooting", "shooting"),
    "home_roll_ast": ("Home assists", "shooting"),
    "home_roll_tov": ("Home turnovers", "shooting"),
    "home_roll_reb": ("Home rebounds", "shooting"),
    "away_roll_efg": ("Away shooting (eFG)", "shooting"),
    "away_roll_ts": ("Away true shooting", "shooting"),
    "away_roll_ast": ("Away assists", "shooting"),
    "away_roll_tov": ("Away turnovers", "shooting"),
    "away_roll_reb": ("Away rebounds", "shooting"),
}


@dataclass
class Contribution:
    """One feature's effect on the home win probability."""

    feature: str
    label: str
    group: str
    value: float
    """The feature's actual value for this game."""
    impact: float
    """Probability points this feature added (positive favors the home team)."""


def _sigmoid(x: float) -> float:
    """Numerically stable logistic function.

    The naive ``1 / (1 + exp(-x))`` overflows for large negative ``x``; this
    form avoids the overflow entirely.
    """
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    z = math.exp(x)
    return z / (1.0 + z)


def explain(
    artifact: ModelArtifact,
    frame: pd.DataFrame,
    proba: float,
    top_n: int = 6,
) -> list[Contribution]:
    """Return the ``top_n`` features that moved this prediction the most.

    ``frame`` must already be aligned to ``artifact.feature_columns`` (one row).
    ``proba`` is the model's predicted home-win probability for that row.
    """
    cols = list(artifact.feature_columns)
    try:
        booster = artifact.model.get_booster()
    except AttributeError:
        # Not a real XGBoost model (e.g. a test double). Attribution is optional
        # metadata; never let it break the prediction itself.
        return []

    dmatrix = xgb.DMatrix(frame, feature_names=cols)
    contribs = booster.predict(dmatrix, pred_contribs=True)[0]

    # The contributions sum to the log-odds margin; the last element is bias.
    margin = float(contribs.sum())

    out: list[Contribution] = []
    for name, raw in zip(cols, contribs[:-1], strict=True):
        delta = float(raw)
        if delta == 0.0:
            continue
        # Probability with this feature's contribution removed, versus the full
        # prediction. This is the honest per-feature effect in probability space.
        without = _sigmoid(margin - delta)
        impact = proba - without
        label, group = FEATURE_LABELS.get(name, (name.replace("_", " "), "other"))
        out.append(
            Contribution(
                feature=name,
                label=label,
                group=group,
                value=round(float(frame.iloc[0][name]), 3),
                impact=round(impact, 4),
            )
        )

    out.sort(key=lambda c: -abs(c.impact))
    return out[:top_n]
