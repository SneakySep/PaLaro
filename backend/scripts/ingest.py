"""Convenience CLI to run the backfill job.

Usage (from ``backend/``)::

    .\\.venv\\Scripts\\python.exe -m scripts.ingest --season 2023-24 --limit 5

See ``data_pipeline/jobs/backfill.py`` for all options.
"""

from data_pipeline.jobs.backfill import main

if __name__ == "__main__":
    raise SystemExit(main())
