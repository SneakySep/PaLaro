from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.predictor import get_artifact

router = APIRouter()


class ModelMetrics(BaseModel):
    """Evaluation metrics recorded alongside the trained artifact."""

    version: str
    accuracy: float | None = None
    log_loss: float | None = None
    roc_auc: float | None = None
    n_features: int
    trained_at: str | None = None


@router.get("/model/metrics", response_model=ModelMetrics)
def model_metrics() -> ModelMetrics:
    """Metrics for the currently loaded model artifact.

    These come from the artifact's sidecar, written at training time on a
    chronological hold-out split. They are the model's measured performance,
    not a guarantee about any individual prediction.
    """
    artifact = get_artifact()
    metrics = artifact.metrics or {}
    version = artifact.version or ""
    # The trainer stamps ``<base>-<UTC timestamp>`` onto the version.
    trained_at = version.split("-", 1)[1] if "-" in version else None

    return ModelMetrics(
        version=version,
        accuracy=metrics.get("accuracy"),
        log_loss=metrics.get("log_loss"),
        roc_auc=metrics.get("roc_auc"),
        n_features=len(artifact.feature_columns),
        trained_at=trained_at,
    )
