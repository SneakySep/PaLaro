"""Persist and reload a trained XGBoost model together with its metadata.

The model itself is written in XGBoost's native ``.ubj`` format (fast, exact
round-trip on all versions). Beside it we store a JSON sidecar recording the
trained feature columns, the model version, and the evaluation metrics. Keeping
the feature list with the model means the prediction server can reorder/reject
inputs identically to what the model was trained on — no drift.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import xgboost as xgb

from app.core.config import settings


@dataclass
class ModelArtifact:
    """A trained model plus the metadata needed to serve it consistently."""

    model: xgb.XGBClassifier
    feature_columns: list[str]
    version: str
    metrics: dict[str, float]

    def save(
        self,
        model_path: str | Path | None = None,
        features_path: str | Path | None = None,
    ) -> tuple[Path, Path]:
        """Write the model and its metadata sidecar, returning both paths."""
        model_path = Path(model_path or settings.model_artifact_path)
        features_path = Path(features_path or settings.feature_columns_path)
        model_path.parent.mkdir(parents=True, exist_ok=True)
        features_path.parent.mkdir(parents=True, exist_ok=True)
        self.model.save_model(str(model_path))
        features_path.write_text(
            json.dumps(
                {
                    "version": self.version,
                    "feature_columns": self.feature_columns,
                    "metrics": self.metrics,
                }
            ),
            encoding="utf-8",
        )
        return model_path, features_path

    @classmethod
    def load(
        cls,
        model_path: str | Path | None = None,
        features_path: str | Path | None = None,
    ) -> ModelArtifact:
        """Reconstruct an artifact from disk (defaults from app settings)."""
        model_path = Path(model_path or settings.model_artifact_path)
        features_path = Path(features_path or settings.feature_columns_path)
        model = xgb.XGBClassifier()
        model.load_model(str(model_path))
        meta = json.loads(features_path.read_text(encoding="utf-8"))
        return cls(
            model=model,
            feature_columns=meta["feature_columns"],
            version=meta["version"],
            metrics=meta["metrics"],
        )
