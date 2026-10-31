from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.game import Game
    from app.models.team import Team


class PlayerGameStat(Base):
    """Per-player box score line for a single game."""

    __tablename__ = "player_game_stats"

    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)

    player_name: Mapped[str] = mapped_column(String(80))
    nba_player_id: Mapped[int] = mapped_column(Integer, index=True)

    minutes: Mapped[float | None] = mapped_column(Float)
    points: Mapped[int | None] = mapped_column(Integer)
    rebounds: Mapped[int | None] = mapped_column(Integer)
    assists: Mapped[int | None] = mapped_column(Integer)
    steals: Mapped[int | None] = mapped_column(Integer)
    blocks: Mapped[int | None] = mapped_column(Integer)
    turnovers: Mapped[int | None] = mapped_column(Integer)
    personal_fouls: Mapped[int | None] = mapped_column(Integer)

    fg_made: Mapped[int | None] = mapped_column(Integer)
    fg_att: Mapped[int | None] = mapped_column(Integer)
    fg3_made: Mapped[int | None] = mapped_column(Integer)
    fg3_att: Mapped[int | None] = mapped_column(Integer)
    ft_made: Mapped[int | None] = mapped_column(Integer)
    ft_att: Mapped[int | None] = mapped_column(Integer)

    game: Mapped[Game] = relationship(back_populates="player_stats")
    team: Mapped[Team] = relationship()
