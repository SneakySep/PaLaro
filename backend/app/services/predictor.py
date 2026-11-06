"""Prediction service: load the persisted :class:`ModelArtifact` and serve win odds.

The route layer stays thin; all model I/O, input alignment, and probability
math live here so they can be unit-tested in isolation and reused by any caller.
"""

from __future__ import annotations

import logging
import math

import pandas as pd
from pydantic import BaseModel, field_validator
from xgboost.core import XGBoostError

from app.core.config import settings
from data_pipeline.training.model import ModelArtifact

logger = logging.getLogger(__name__)


class PredictRequest(BaseModel):
    """Body for a single game prediction.

    ``features`` is a name-keyed dict of the *engineered* feature values. The
    server maps them onto the trained ``feature_columns`` (reordering, ignoring
    extras, rejecting missing) so the model sees exactly the same columns it
    was trained on — no drift.
    """

    game_id: str
    home_team: str
    away_team: str
    features: dict[str, float]

    @field_validator("features")
    @classmethod
    def validate_features(cls, v: dict[str, float]) -> dict[str, float]:
        """Reject NaN or infinite values early with a clear message."""
        for key, val in v.items():
            if not isinstance(val, (int, float)):
                raise ValueError(f"feature '{key}' must be numeric, got {type(val).__name__}")
            if math.isnan(val) or math.isinf(val):
                raise ValueError(f"feature '{key}' must be finite, got {val}")
        return v


class PredictionResponse(BaseModel):
    """Shape the frontend expects for a game prediction."""

    game_id: str
    home_team: str
    away_team: str
    home_win_prob: float  # 0..1
    confidence_interval: list[float]  # [lower, upper] on home_win_prob
    model_version: str


class FeatureMismatchError(ValueError):
    """Raised when request features do not match the trained feature columns."""


class ModelNotReadyError(RuntimeError):
    """Raised when no trained model artifact exists on disk yet."""


_artifact_cache: dict[str, ModelArtifact] = {}


def get_artifact() -> ModelArtifact:
    """Load the trained artifact once, caching by artifact path."""
    key = str(settings.model_artifact_path)
    if key in _artifact_cache:
        return _artifact_cache[key]
    try:
        artifact = ModelArtifact.load()
    except (FileNotFoundError, OSError, XGBoostError) as exc:
        raise ModelNotReadyError(
            "No trained model artifact found; run training before predicting."
        ) from exc
    _artifact_cache[key] = artifact
    return artifact


def aligned_feature_frame(
    features: dict[str, float], feature_columns: list[str]
) -> pd.DataFrame:
    """Build a single-row frame whose columns are exactly ``feature_columns``.

    Extra keys in ``features`` are dropped; any required feature that is missing
    raises :class:`FeatureMismatchError`.
    """
    missing = [c for c in feature_columns if c not in features]
    if missing:
        raise FeatureMismatchError(f"missing required feature(s): {', '.join(missing)}")
    row = {c: features[c] for c in feature_columns}
    return pd.DataFrame([row], columns=feature_columns)


def _wilson_interval(prob: float, z: float = 1.96) -> list[float]:
    """95% Wilson score interval around a single predicted probability.

    XGBoost gives a point estimate, so we wrap it in a binomial-sampling
    interval. For a single sample this is a loose but conservative band; a more
    rigorous uncertainty estimate (out-of-fold calibration / bagged quantiles)
    is a documented follow-up.
    """
    n = 1
    z2 = z * z
    p = min(max(prob, 0.0), 1.0)
    denom = 1 + z2 / n
    centre = (p + z2 / (2 * n)) / denom
    margin = z * ((p * (1 - p) / n + z2 / (4 * n * n)) ** 0.5) / denom
    lo = min(max(centre - margin, 0.0), 1.0)
    hi = min(max(centre + margin, 0.0), 1.0)
    return [round(lo, 4), round(hi, 4)]


def predict(request: PredictRequest) -> PredictionResponse:
    """Produce a :class:`PredictionResponse` for a single game request."""
    artifact = get_artifact()
    frame = aligned_feature_frame(request.features, artifact.feature_columns)
    prob = float(artifact.model.predict_proba(frame)[0, 1])
    logger.info(
        "prediction game=%s %s vs %s prob=%.4f model=%s",
        request.game_id,
        request.home_team,
        request.away_team,
        prob,
        artifact.version,
    )
    return PredictionResponse(
        game_id=request.game_id,
        home_team=request.home_team,
        away_team=request.away_team,
        home_win_prob=round(prob, 4),
        confidence_interval=_wilson_interval(prob),
        model_version=artifact.version,
    )
