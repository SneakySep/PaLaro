from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import Game

router = APIRouter()


class GameOut(BaseModel):
    game_id: str
    date: str
    home_team: str
    away_team: str
    home_points: int | None
    away_points: int | None
    status: str = "scheduled"


@router.get("/games", response_model=list[GameOut])
def list_games(
    status: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> list[GameOut]:
    """Return games from the database, optionally filtered by status.

    Defaults to the 50 most recent games. Pass ``?status=scheduled`` to get
    only upcoming games, or ``?status=final`` for completed ones.
    """
    stmt = (
        select(Game)
        .options(joinedload(Game.home_team), joinedload(Game.away_team))
        .order_by(Game.game_date.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(Game.status == status)

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
        )
        for g in games
    ]
