"""Convenience CLI to run the XGBoost training job.

Usage (from ``backend/``):::

    .\\.venv\\Scripts\\python.exe -m data_pipeline.training.train --season 2023

See ``data_pipeline/training/train.py`` for all options.
"""

from data_pipeline.training.train import main

if __name__ == "__main__":
    raise SystemExit(main())
