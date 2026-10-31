"""XGBoost model training pipeline.

``data_pipeline.training`` turns the supervised :class:`Dataset` produced by
``data_pipeline.features.build`` into a versioned, persisted XGBoost model.
It is deliberately split into small, testable pieces:

- :mod:`data_pipeline.training.split` — leakage-free chronological splits.
- :mod:`data_pipeline.training.model` — artifact persistence + metadata.
- :mod:`data_pipeline.training.train` — orchestration + evaluation report.

Run the CLI from ``backend/``::

    python -m data_pipeline.training.train --season 2023
"""

__all__ = ["EvalReport", "ModelArtifact", "split_by_time", "train_model"]
