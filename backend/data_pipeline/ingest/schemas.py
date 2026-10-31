"""Typed row models produced by data providers.

These TypedDicts are the canonical contract between the provider layer and the
store/writer layer, decoupling stats sources (nba_api today; API-NBA/Sportradar
later) from our storage and feature engineering.
"""

from typing import TypedDict


class TeamDict(TypedDict):
    """A single NBA franchise as surfaced by the active provider."""

    nba_id: int
    name: str
    abbr: str
    city: str | None
    conference: str | None
    division: str | None


class GameDict(TypedDict):
    """A single game with both teams as abbreviations and (when final) scores."""

    nba_game_id: str
    season: int
    game_date: str  # ISO-8601 date, e.g. "2023-10-24"
    status: str
    home_abbr: str
    away_abbr: str
    home_points: int | None
    away_points: int | None


class PlayerLineDict(TypedDict):
    """One player's box-score line for one game."""

    nba_game_id: str
    team_abbr: str
    player_name: str
    nba_player_id: int
    minutes: float | None
    points: int | None
    rebounds: int | None
    assists: int | None
    steals: int | None
    blocks: int | None
    turnovers: int | None
    personal_fouls: int | None
    fg_made: int | None
    fg_att: int | None
    fg3_made: int | None
    fg3_att: int | None
    ft_made: int | None
    ft_att: int | None


class BoxScore(TypedDict):
    """Complete box score for a single game."""

    nba_game_id: str
    player_lines: list[PlayerLineDict]
