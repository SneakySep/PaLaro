"""Provider abstraction so ingestion can swap stats sources cleanly.

Currently implemented by :class:`NBA_APIProvider` (stats.nba.com via the
``nba_api`` package). In the future API-NBA / Sportradar providers can subclass
this same interface without touching the storage or feature layers.
"""

from abc import ABC, abstractmethod

from data_pipeline.ingest.schemas import BoxScore, GameDict, TeamDict


class DataProvider(ABC):
    """Contract every stats provider must satisfy."""

    @abstractmethod
    def get_teams(self) -> list[TeamDict]:
        """Return metadata for every NBA franchise."""

    @abstractmethod
    def get_team_game_log(self, season: str) -> list[GameDict]:
        """Return one row per game (derived from the league game log).

        ``season`` uses the nba_api format, e.g. ``"2023-24"``.
        """

    @abstractmethod
    def get_box_score(self, game_id: str) -> BoxScore:
        """Return the full box score (per-player lines) for a single game."""

    @abstractmethod
    def get_scoreboard(self, game_date: str) -> list[GameDict]:
        """Return the slate of games for one calendar day.

        ``game_date`` is an ISO date (``"YYYY-MM-DD"``; stats.nba.com interprets
        it in US Eastern time). Games that have not started come back with
        ``status="scheduled"`` and ``None`` scores; in-progress games are
        ``"live"``; finished ones are ``"final"`` with final scores. Works for
        past and future dates alike, so one call seeds both historical results
        and upcoming scheduled games.
        """
