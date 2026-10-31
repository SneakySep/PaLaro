"""Feature engineering that turns raw ingested data into a supervised dataset.

Modules in this package are pure helper builders (``rolling``, ``context``,
``advanced_metrics``) plus an orchestrator (``build``) that assembles the final
feature matrix + target the XGBoost trainer consumes.
"""

from data_pipeline.features.build import Dataset, build_dataset

__all__ = ["Dataset", "build_dataset"]
