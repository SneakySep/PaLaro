"""Orchestrated historical backfill from a :class:`DataProvider` into Postgres.

Run directly::

    python -m data_pipeline.jobs.backfill --season 2023-24 --limit 30

or through the convenience wrapper ``scripts/ingest.py``.
"""

from __future__ import annotations

import argparse
import sys
import time

import requests
from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models import Game, PlayerGameStat
from data_pipeline.ingest.providers import NBA_APIProvider
from data_pipeline.store.postgres_writer import PostgresWriter


def _already_has_box(writer: PostgresWriter, nba_game_id: str) -> bool:
    """True if a box score for this game is already persisted (resume support)."""
    count = writer.session.scalar(
        select(func.count(PlayerGameStat.id))
        .select_from(Game)
        .join(PlayerGameStat, PlayerGameStat.game_id == Game.id)
        .where(Game.nba_game_id == nba_game_id)
    )
    return (count or 0) > 0


def _fetch_box(provider: NBA_APIProvider, game_id: str, attempts: int = 5) -> dict:
    """Fetch one box score, retrying transient failures with backoff.

    stats.nba.com intermittently rate-limits, briefly blocks rapid request
    bursts, or returns a malformed payload that makes the endpoint parser raise
    ``AttributeError`` (a ``None`` team-stats block). None of those are fatal
    for a single game, so retry the whole fetch rather than aborting the run.
    """
    delay = 2.0
    last: Exception | None = None
    for i in range(attempts):
        try:
            return provider.get_box_score(game_id)
        except (requests.exceptions.RequestException, AttributeError, KeyError) as exc:
            last = exc
            print(f"    retry {i + 1}/{attempts} for {game_id} ({exc.__class__.__name__}) ...")
            time.sleep(delay)
            delay *= 2
    assert last is not None
    raise last


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

            consecutive_failures = 0
            for idx, game_id in enumerate(game_ids, start=1):
                if not args.dry_run and _already_has_box(writer, game_id):
                    print(f"  box score {game_id} already present; skipping")
                    continue
                print(f"  box score {game_id} ...")
                try:
                    box = _fetch_box(provider, game_id)
                except Exception as exc:  # one bad game must not abort the season
                    consecutive_failures += 1
                    print(f"  skipped {game_id}: {exc.__class__.__name__}")
                    # A single bad/edge-case game shouldn't abort the season;
                    # only bail out on a run of failures (e.g. a rate-limit block).
                    if consecutive_failures >= 3:
                        print("  aborting box-score pass: too many consecutive failures")
                        break
                    continue
                consecutive_failures = 0
                if not args.dry_run:
                    writer.upsert_box_scores([box])
                    total["box_scores"] += 1
                    # Commit periodically so partial progress survives a crash,
                    # a network hard-block, or an interrupted run.
                    if idx % 50 == 0:
                        writer.session.commit()
                        print(f"  progress: committed {idx}/{len(game_ids)} games")

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
