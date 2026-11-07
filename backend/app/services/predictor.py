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
    """Shape the frontend expects for a game prediction.

    Deliberately carries no confidence interval. The previous Wilson interval
    was computed from a single sample (``n=1``), so it returned roughly
    [0.09, 0.97] for every prediction regardless of the model's actual
    certainty. A constant band is not uncertainty; it is noise dressed as
    precision, and it is better to omit the field than to ship it.
    """

    game_id: str
    home_team: str
    away_team: str
    home_win_prob: float  # 0..1
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
        model_version=artifact.version,
    )
