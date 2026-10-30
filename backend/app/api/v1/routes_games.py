from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class GameOut(BaseModel):
    game_id: str
    date: str
    home_team: str
    away_team: str
    status: str = "scheduled"


@router.get("/games", response_model=list[GameOut])
def list_games() -> list[GameOut]:
    """Return upcoming games. (Skeleton — real data from Postgres + ingestion later.)"""
    return []
