"""Sync the NBA scoreboard (a day's slate of games) into the database.

Run directly::

    python -m data_pipeline.jobs.sync_scoreboard --days 7

or through the convenience wrapper ``scripts/sync_scoreboard.py``.

For each requested date the provider's scoreboard is upserted into ``games``:
future dates arrive as ``status="scheduled"`` rows (the pool the upcoming
predictions endpoint scores), finished ones as ``"final"`` with scores, and
in-progress ones as ``"live"``. Upserts are idempotent on ``nba_game_id``, so
re-running a sync only refreshes the rows it already created.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta

from app.db.session import SessionLocal
from data_pipeline.ingest.providers import NBA_APIProvider
from data_pipeline.store.postgres_writer import PostgresWriter


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Sync NBA scoreboard slates (scheduled/final games) into PaLaro DB",
    )
    parser.add_argument("--date", default=None,
                        help="First slate date, ISO YYYY-MM-DD (default: today)")
    parser.add_argument("--days", type=int, default=1,
                        help="Number of consecutive days to sync (default 1)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch but never write to the database")
    return parser


def run_sync(args: argparse.Namespace) -> int:
    if args.days < 1:
        print("error: --days must be >= 1", file=sys.stderr)
        return 2
    start = date.fromisoformat(args.date) if args.date else date.today()

    provider = NBA_APIProvider(use_sleep=False)
    writer = PostgresWriter(SessionLocal())
    total_touched = 0

    try:
        for offset in range(args.days):
            day = (start + timedelta(days=offset)).isoformat()
            games = provider.get_scoreboard(day)
            print(f"{day}: {len(games)} game(s) on the slate")
            if args.dry_run:
                for g in games:
                    print(f"    {g['away_abbr']} @ {g['home_abbr']} — {g['status']}")
                continue
            summary = writer.upsert_games(games)
            total_touched += summary.created + summary.updated
            print(f"    upserted {summary.created} new, {summary.updated} updated")
        if not args.dry_run:
            writer.session.commit()
            print("committed to database")
    finally:
        writer.session.close()

    print(f"done. games touched: {total_touched}")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return run_sync(args)


if __name__ == "__main__":
    raise SystemExit(main())
