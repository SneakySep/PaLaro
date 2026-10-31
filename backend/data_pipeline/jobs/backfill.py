"""Orchestrated historical backfill from a :class:`DataProvider` into Postgres.

Run directly::

    python -m data_pipeline.jobs.backfill --season 2023-24 --limit 30

or through the convenience wrapper ``scripts/ingest.py``.
"""

from __future__ import annotations

import argparse
import sys

from app.db.session import SessionLocal
from data_pipeline.ingest.providers import NBA_APIProvider
from data_pipeline.store.postgres_writer import PostgresWriter


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Backfill PaLaro DB from stats.nba.com")
    parser.add_argument("--season", action="append", dest="seasons",
                        help="Season(s) to ingest, e.g. 2023-24 (repeatable)")
    parser.add_argument("--start-season", help="Start season, e.g. 2023")
    parser.add_argument("--end-season", help="End season (inclusive), e.g. 2024")
    parser.add_argument("--limit", type=int, default=0,
                        help="Max number of box-score requests (0 = none)")
    parser.add_argument("--schedule-only", action="store_true",
                        help="Only ingest teams + schedules, skip box scores")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch but never write to the database")
    parser.add_argument("--sleep", type=float, default=None,
                        help="Override seconds between box-score requests")
    return parser


def resolve_seasons(args: argparse.Namespace) -> list[str]:
    seasons: list[str] = []
    if args.seasons:
        seasons.extend(args.seasons)
    if args.start_season or args.end_season:
        start = int(args.start_season) if args.start_season else int(args.end_season)
        end = int(args.end_season) if args.end_season else start
        seasons.extend(f"{y}-{str(y + 1)[-2:]}" for y in range(start, end + 1))
    return list(dict.fromkeys(seasons))


def run_backfill(args: argparse.Namespace) -> int:
    seasons = resolve_seasons(args)
    if not seasons:
        print("error: provide --season or --start-season/--end-season", file=sys.stderr)
        return 2

    provider = NBA_APIProvider(sleep=args.sleep)
    writer = PostgresWriter(SessionLocal())
    total = {"teams": 0, "games": 0, "box_scores": 0}

    try:
        # 1) Teams (cheap, once).
        print("fetching teams ...")
        teams = provider.get_teams()
        total["teams"] = len(teams)
        if not args.dry_run:
            writer.upsert_teams(teams)
            print(f"  upserted {len(teams)} teams")

        box_score_budget = args.limit if args.limit > 0 else None

        for season in seasons:
            print(f"fetching league game log for {season} ...")
            games = provider.get_team_game_log(season)
            if not args.dry_run:
                summary = writer.upsert_games(games)
                total["games"] += summary.created
                print(f"  season {season}: {summary.created} new games "
                      f"({summary.updated} updated)")

            if args.schedule_only:
                continue

            # Oldest games first so box scores fill chronologically.
            game_ids = sorted(g["nba_game_id"] for g in games)
            if box_score_budget is not None:
                game_ids = game_ids[:box_score_budget]

            for game_id in game_ids:
                print(f"  box score {game_id} ...")
                box = provider.get_box_score(game_id)
                if not args.dry_run:
                    writer.upsert_box_scores([box])
                    total["box_scores"] += 1

        if not args.dry_run:
            writer.session.commit()
            print("committed to database")
    finally:
        writer.session.close()

    print(f"done. teams={total['teams']} games={total['games']} "
          f"box_scores={total['box_scores']}")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return run_backfill(args)


if __name__ == "__main__":
    raise SystemExit(main())
