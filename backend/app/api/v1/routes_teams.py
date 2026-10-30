from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class TeamOut(BaseModel):
    id: int
    abbr: str
    name: str


@router.get("/teams", response_model=list[TeamOut])
def list_teams() -> list[TeamOut]:
    """Return known teams. (Skeleton — populated during ingestion.)"""
    return []
