from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import Game, Team

router = APIRouter()


class GameOut(BaseModel):
    game_id: str
    date: str
    home_team: str
    away_team: str
    home_points: int | None
    away_points: int | None
    status: str = "scheduled"
    season: int | None = None


class SeasonOut(BaseModel):
    season: int
    games: int


@router.get("/games", response_model=list[GameOut])
def list_games(
    response: Response,
    status: str | None = None,
    team: str | None = Query(
        default=None,
        description="Filter to games involving this team abbreviation (e.g. BOS)",
    ),
    season: int | None = Query(default=None, description="Season start year, e.g. 2026"),
    date_from: date | None = Query(default=None, description="Inclusive lower bound"),
    date_to: date | None = Query(default=None, description="Inclusive upper bound"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[GameOut]:
    """Return games from the database with optional filters.

    Filters compose: pass ``status=scheduled&team=BOS`` for Boston's upcoming
    games, or ``date_from``/``date_to`` to page through a date window. Results
    are ordered newest-first and paginated with ``limit``/``offset``. The total
    number of matching rows is returned in the ``X-Total-Count`` header so the
    client can build pagination without a second request.
    """
    conditions = []
    if status:
        conditions.append(Game.status == status)
    if season is not None:
        conditions.append(Game.season == season)
    if date_from is not None:
        conditions.append(Game.game_date >= date_from)
    if date_to is not None:
        conditions.append(Game.game_date <= date_to)
    if team:
        abbr = team.upper()
        team_id = db.scalar(select(Team.id).where(Team.abbr == abbr))
        if team_id is None:
            response.headers["X-Total-Count"] = "0"
            return []
        conditions.append(
            (Game.home_team_id == team_id) | (Game.away_team_id == team_id)
        )

    total = db.scalar(select(func.count(Game.id)).where(*conditions)) or 0
    response.headers["X-Total-Count"] = str(total)

    stmt = (
        select(Game)
        .options(joinedload(Game.home_team), joinedload(Game.away_team))
        .where(*conditions)
        .order_by(Game.game_date.desc(), Game.id.desc())
        .limit(limit)
        .offset(offset)
    )
    games = db.execute(stmt).scalars().all()
    return [
        GameOut(
            game_id=g.nba_game_id,
            date=g.game_date.isoformat(),
            home_team=g.home_team.abbr,
            away_team=g.away_team.abbr,
            home_points=g.home_points,
            away_points=g.away_points,
            status=g.status,
            season=g.season,
        )
        for g in games
    ]


@router.get("/seasons", response_model=list[SeasonOut])
def list_seasons(db: Session = Depends(get_db)) -> list[SeasonOut]:
    """Seasons present in the database, newest first, with game counts."""
    rows = db.execute(
        select(Game.season, func.count(Game.id))
        .where(Game.season.is_not(None))
        .group_by(Game.season)
        .order_by(Game.season.desc())
    ).all()
    return [SeasonOut(season=int(s), games=int(c)) for s, c in rows]
