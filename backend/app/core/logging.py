"""Application-wide structured logging configuration.

Call ``configure_logging()`` once at startup (in ``create_app``) to get
consistent, timestamped, level-filtered log output across all modules.
"""

from __future__ import annotations

import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    """Set up root logger with a structured format.

    The format includes timestamp, level, module, and message — enough to
    trace requests through the API without a full APM.
    """
    root = logging.getLogger()
    # Avoid adding duplicate handlers on re-import (e.g. uvicorn --reload).
    if root.handlers:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    root.addHandler(handler)
    root.setLevel(level.upper())

    # Quiet noisy third-party loggers.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
