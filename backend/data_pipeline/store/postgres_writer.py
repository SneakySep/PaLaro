"""PostgreSQL writer — upserts provider data into the ORM models.

Design
------
* Idempotent: matching on unique keys (``nba_id`` / ``nba_game_id`` / the
  ``game_id + nba_player_id`` pair) so re-running a backfill never duplicates.
* All writes go through a single SQLAlchemy :class:`Session`; the caller owns
  committing (or rolling back) so partial backfills can be handled gracefully.
"""

from __future__ import annotations

from datetime import date
from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Game, PlayerGameStat, Team
from data_pipeline.ingest.schemas import BoxScore, GameDict, TeamDict

_PLAYER_STAT_FIELDS = (
    "minutes",
    "points",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "personal_fouls",
    "fg_made",
    "fg_att",
    "fg3_made",
    "fg3_att",
    "ft_made",
    "ft_att",
)


class Summary(NamedTuple):
    """Simple created/updated counts returned by each upsert method."""

    created: int = 0
    updated: int = 0


class PostgresWriter:
    """Wraps upsert logic against a live SQLAlchemy session."""

    def __init__(self, session: Session) -> None:
        self.session = session

    # -- teams ---------------------------------------------------------------
    def upsert_teams(self, teams: list[TeamDict]) -> Summary:
        created = updated = 0
        for data in teams:
            obj = self.session.scalar(select(Team).where(Team.nba_id == data["nba_id"]))
            if obj is None:
                self.session.add(Team(**data))
                created += 1
            else:
                changed = False
                for key, value in data.items():
                    if getattr(obj, key) != value:
                        setattr(obj, key, value)
                        changed = True
                updated += int(changed)
        self.session.flush()
        return Summary(created=created, updated=updated)

    # -- games ---------------------------------------------------------------
    def upsert_games(self, games: list[GameDict]) -> Summary:
        abbr_to_id = self._team_ids_by_abbr()
        created = updated = 0
        for data in games:
            home_id = abbr_to_id.get(data["home_abbr"])
            away_id = abbr_to_id.get(data["away_abbr"])
            if home_id is None or away_id is None:
                # Unknown team abbreviation — skip until teams are ingested.
                continue

            obj = self.session.scalar(
                select(Game).where(Game.nba_game_id == data["nba_game_id"])
            )
            if obj is None:
                self.session.add(
                    Game(
                        nba_game_id=data["nba_game_id"],
                        season=data["season"],
                        game_date=date.fromisoformat(data["game_date"]),
                        status=data["status"],
                        home_team_id=home_id,
                        away_team_id=away_id,
                        home_points=data["home_points"],
                        away_points=data["away_points"],
                    )
                )
                created += 1
            else:
                changed = False
                fields = {
                    "season": data["season"],
                    "game_date": date.fromisoformat(data["game_date"]),
                    "status": data["status"],
                    "home_team_id": home_id,
                    "away_team_id": away_id,
                    "home_points": data["home_points"],
                    "away_points": data["away_points"],
                }
                for key, value in fields.items():
                    if getattr(obj, key) != value:
                        setattr(obj, key, value)
                        changed = True
                updated += int(changed)
        self.session.flush()
        return Summary(created=created, updated=updated)

    # -- box scores ----------------------------------------------------------
    def upsert_box_scores(self, boxes: list[BoxScore]) -> Summary:
        abbr_to_id = self._team_ids_by_abbr()
        created = updated = 0
        for box in boxes:
            game = self.session.scalar(
                select(Game).where(Game.nba_game_id == box["nba_game_id"])
            )
            if game is None:
                continue  # Parent game not yet in the DB.
            for line in box["player_lines"]:
                team_id = abbr_to_id.get(line["team_abbr"])
                if team_id is None:
                    continue
                obj = self.session.scalar(
                    select(PlayerGameStat).where(
                        PlayerGameStat.game_id == game.id,
                        PlayerGameStat.nba_player_id == line["nba_player_id"],
                    )
                )
                values = {field: line.get(field) for field in _PLAYER_STAT_FIELDS}
                if obj is None:
                    self.session.add(
                        PlayerGameStat(
                            game_id=game.id,
                            team_id=team_id,
                            player_name=line["player_name"],
                            nba_player_id=line["nba_player_id"],
                            **values,
                        )
                    )
                    created += 1
                else:
                    changed = False
                    if obj.team_id != team_id:
                        obj.team_id = team_id
                        changed = True
                    for key, value in values.items():
                        if getattr(obj, key) != value:
                            setattr(obj, key, value)
                            changed = True
                    updated += int(changed)
        self.session.flush()
        return Summary(created=created, updated=updated)

    def _team_ids_by_abbr(self) -> dict[str, int]:
        rows = self.session.execute(select(Team.abbr, Team.id)).all()
        return {abbr: team_id for abbr, team_id in rows}

