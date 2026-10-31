from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.player_game import PlayerGameStat
    from app.models.team import Team


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(primary_key=True)
    nba_game_id: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    season: Mapped[int] = mapped_column(Integer, index=True)
    game_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(20), default="scheduled")

    home_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    away_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)

    home_points: Mapped[int | None] = mapped_column(Integer)
    away_points: Mapped[int | None] = mapped_column(Integer)

    home_team: Mapped[Team] = relationship(
        back_populates="home_games", foreign_keys=[home_team_id]
    )
    away_team: Mapped[Team] = relationship(
        back_populates="away_games", foreign_keys=[away_team_id]
    )
    player_stats: Mapped[list[PlayerGameStat]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )
