"""Concrete :class:`DataProvider` backed by stats.nba.com via ``nba_api``.

Notes
-----
* Team-level game rows come from :class:`nba_api.stats.endpoints.LeagueGameLog`
  (one row per team per game), which gives game IDs, dates, matchups and final
  scores without iterating the calendar.
* Per-player box scores cost one request per game, so we throttle with a small
  sleep to avoid being blocked by stats.nba.com.
* Best-effort: a failing box score raises and the caller (backfill job) skips
  that game and continues.
"""

from __future__ import annotations

import time
from datetime import date
from typing import ClassVar

from data_pipeline.ingest.providers.base import DataProvider
from data_pipeline.ingest.schemas import BoxScore, GameDict, PlayerLineDict, TeamDict


def _to_int(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


_RAW_TO_LINE = {
    "PLAYER_NAME": "player_name",
    "PLAYER_ID": "nba_player_id",
    "MIN": "minutes",
    "PTS": "points",
    "REB": "rebounds",
    "AST": "assists",
    "STL": "steals",
    "BLK": "blocks",
    # BoxScoreTraditionalV2 names this column "TO", not "TOV". Using the wrong
    # key silently yielded None for every player, which made the rolling
    # turnover features constant zero in both training and serving.
    "TO": "turnovers",
    "PF": "personal_fouls",
    "FGM": "fg_made",
    "FGA": "fg_att",
    "FG3M": "fg3_made",
    "FG3A": "fg3_att",
    "FTM": "ft_made",
    "FTA": "ft_att",
}

_INT_FIELDS = {
    "nba_player_id",
    "points",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "personal_fouls",
    "fg_made",
    "fg_att",
    "fg3_made",
    "fg3_att",
    "ft_made",
    "ft_att",
}


def _minutes(value) -> float | None:
    """Convert an NBA ``MIN`` value (``"24:35"`` or ``"24"``) to decimal minutes."""
    if value is None or value == "":
        return None
    text = str(value).strip()
    if ":" in text:
        try:
            minutes, seconds = text.split(":")
            return round(int(minutes) + int(seconds) / 60.0, 2)
        except (TypeError, ValueError):
            return None
    return _to_float(text)


class NBA_APIProvider(DataProvider):
    """Fetches teams, schedules and box scores from stats.nba.com."""

    SLEEP_BETWEEN_REQUESTS = 0.5  # seconds between box-score requests

    def __init__(
        self,
        user_agent: str | None = None,
        sleep: float | None = None,
        use_sleep: bool = True,
    ) -> None:
        self._user_agent = user_agent
        self._use_sleep = use_sleep
        if sleep is not None:
            self.SLEEP_BETWEEN_REQUESTS = sleep

    def _throttle(self) -> None:
        if self._use_sleep and self.SLEEP_BETWEEN_REQUESTS > 0:
            time.sleep(self.SLEEP_BETWEEN_REQUESTS)

    # -- teams ---------------------------------------------------------------
    def get_teams(self) -> list[TeamDict]:
        from nba_api.stats.static.teams import get_teams

        return [
            TeamDict(
                nba_id=int(team["id"]),
                name=team["full_name"],
                abbr=team["abbreviation"],
                city=team.get("city"),
                conference=team.get("conference"),
                division=team.get("division"),
            )
            for team in get_teams()
        ]

    # -- per-game rows from the league game log --------------------------------
    def get_team_game_log(self, season: str) -> list[GameDict]:
        from nba_api.stats.endpoints import LeagueGameLog

        log = LeagueGameLog(season=season, season_type_all_star="Regular Season")
        frame = log.get_data_frames()[0]

        by_game: dict[str, list[dict]] = {}
        for row in frame.to_dict("records"):
            by_game.setdefault(str(row["GAME_ID"]), []).append(row)

        games: list[GameDict] = []
        for game_id, rows in by_game.items():
            games.append(self._game_from_rows(game_id, rows, season))
        return games

    @staticmethod
    def _game_from_rows(
        game_id: str,
        rows: list[dict],
        season: str,
    ) -> GameDict:
        """Derive a :class:`GameDict` from the home/away game-log rows."""
        home_row: dict | None = None
        away_row: dict | None = None
        for row in rows:
            if " @ " in str(row.get("MATCHUP") or ""):
                away_row = row
            else:
                home_row = row

        if home_row is not None:
            t_abbr, o_abbr = str(home_row["MATCHUP"]).split(" vs. ")
            home_abbr, away_abbr = t_abbr.strip(), o_abbr.strip()
        else:
            # Only an away "@" row present: its team is the first token,
            # the opponent (home team) follows the "@".
            away_token, home_token = (p.strip() for p in str(away_row["MATCHUP"]).split(" @ "))
            home_abbr, away_abbr = home_token, away_token

        home_pts = _to_int(home_row.get("PTS")) if home_row is not None else None
        away_pts = _to_int(away_row.get("PTS")) if away_row is not None else None
        date_row = home_row if home_row is not None else away_row
        game_date = str(date_row["GAME_DATE"])[:10]

        return GameDict(
            nba_game_id=game_id,
            season=int(season.split("-")[0]),
            game_date=game_date,
            status="final" if home_pts is not None else "scheduled",
            home_abbr=home_abbr,
            away_abbr=away_abbr,
            home_points=home_pts,
            away_points=away_pts,
        )

    # -- scoreboard (daily slate) -----------------------------------------------
    #: ScoreboardV3 ``gameStatus`` codes mapped onto our status strings.
    _GAME_STATUS_MAP: ClassVar[dict[int, str]] = {1: "scheduled", 2: "live", 3: "final"}

    def get_scoreboard(self, game_date: str) -> list[GameDict]:
        """Return every game on ``game_date`` (``"YYYY-MM-DD"``, ET) as GameDicts.

        Uses :class:`ScoreboardV3`, which serves past and future slates alike,
        so the same call covers historical results and upcoming scheduled games.
        """
        from nba_api.stats.endpoints import ScoreboardV3

        raw = ScoreboardV3(game_date=game_date, timeout=30).get_dict()
        board = raw.get("scoreboard", {})
        return [
            self._game_from_scoreboard_item(item, game_date)
            for item in board.get("games", [])
        ]

    @classmethod
    def _game_from_scoreboard_item(cls, item: dict, game_date: str) -> GameDict:
        """Convert one ScoreboardV3 game entry into a :class:`GameDict`."""
        home, away = item.get("homeTeam") or {}, item.get("awayTeam") or {}
        status = cls._status_from_item(item)
        scored = status in ("final", "live")  # not-started games report score 0
        return GameDict(
            nba_game_id=str(item["gameId"]),
            season=cls._season_from_date(game_date),
            game_date=game_date,
            status=status,
            home_abbr=str(home.get("teamTricode") or ""),
            away_abbr=str(away.get("teamTricode") or ""),
            home_points=_to_int(home.get("score")) if scored else None,
            away_points=_to_int(away.get("score")) if scored else None,
        )

    @classmethod
    def _status_from_item(cls, item: dict) -> str:
        """Map ScoreboardV3's ``gameStatus`` code (1/2/3) onto our statuses."""
        try:
            return cls._GAME_STATUS_MAP.get(int(item.get("gameStatus")), "scheduled")
        except (TypeError, ValueError):
            text = str(item.get("gameStatusText") or "")
            return "final" if text.lower().startswith("final") else "scheduled"

    @staticmethod
    def _season_from_date(game_date: str) -> int:
        """NBA season label (its start year) for an ISO date.

        July-December games belong to the season starting that year; January-
        June games belong to the season that started the previous year (the
        ``"2023-24"`` season is labelled ``2023``).
        """
        d = date.fromisoformat(game_date)
        return d.year if d.month >= 7 else d.year - 1

    # -- box score -------------------------------------------------------------
    def get_box_score(self, game_id: str) -> BoxScore:
        from nba_api.stats.endpoints import BoxScoreTraditionalV2
        from nba_api.stats.static.teams import get_teams

        id_to_abbr = {int(t["id"]): t["abbreviation"] for t in get_teams()}

        box = BoxScoreTraditionalV2(game_id=game_id)
        frame = box.player_stats.get_data_frame()

        player_lines: list[PlayerLineDict] = []
        for raw in frame.to_dict("records"):
            player_id = _to_int(raw.get("PLAYER_ID"))
            if player_id is None:
                # Skip aggregate / blank rows that carry no player id.
                continue
            raw = dict(raw)
            raw["team_abbr"] = id_to_abbr.get(_to_int(raw.get("TEAM_ID")), "")
            player_lines.append(self._convert_line(game_id, raw))
        return BoxScore(nba_game_id=game_id, player_lines=player_lines)

    @classmethod
    def _convert_line(cls, game_id: str, raw: dict) -> PlayerLineDict:
        """Convert one raw box-score row into a :class:`PlayerLineDict`."""
        line: dict = {"nba_game_id": game_id}
        for raw_key, field in _RAW_TO_LINE.items():
            value = raw.get(raw_key)
            if field in _INT_FIELDS:
                line[field] = _to_int(value)
            elif field == "minutes":
                line[field] = _minutes(value)
            else:
                line[field] = value
        line["team_abbr"] = raw.get("team_abbr", "")
        return PlayerLineDict(**line)

