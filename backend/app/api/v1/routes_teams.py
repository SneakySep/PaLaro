from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Team

router = APIRouter()


class TeamOut(BaseModel):
    id: int
    abbr: str
    name: str


@router.get("/teams", response_model=list[TeamOut])
def list_teams(db: Session = Depends(get_db)) -> list[TeamOut]:
    """Return all known teams from the database."""
    teams = db.execute(select(Team).order_by(Team.abbr)).scalars().all()
    return [TeamOut(id=t.id, abbr=t.abbr, name=t.name) for t in teams]
