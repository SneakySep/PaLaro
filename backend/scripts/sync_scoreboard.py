"""Convenience CLI to run the scoreboard sync job.

Usage (from ``backend/``)::

    .\\.venv\\Scripts\\python.exe -m scripts.sync_scoreboard --days 7

See ``data_pipeline/jobs/sync_scoreboard.py`` for all options.
"""

from data_pipeline.jobs.sync_scoreboard import main

if __name__ == "__main__":
    raise SystemExit(main())
