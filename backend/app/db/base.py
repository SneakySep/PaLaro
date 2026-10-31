"""Shared declarative base + model registry for Alembic autogenerate."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for all PaLaro ORM models."""


# Import models so they are registered on Base.metadata before autogenerate runs.
from app.models import game, player_game, team  # noqa: F401
