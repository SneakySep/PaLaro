from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.game import Game


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    nba_id: Mapped[int] = mapped_column(unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    abbr: Mapped[str] = mapped_column(String(8), index=True)
    city: Mapped[str | None] = mapped_column(String(60))
    conference: Mapped[str | None] = mapped_column(String(30))
    division: Mapped[str | None] = mapped_column(String(60))

    home_games: Mapped[list[Game]] = relationship(
        back_populates="home_team", foreign_keys="Game.home_team_id"
    )
    away_games: Mapped[list[Game]] = relationship(
        back_populates="away_team", foreign_keys="Game.away_team_id"
    )
