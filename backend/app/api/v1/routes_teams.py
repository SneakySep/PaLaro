from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Game, Team

router = APIRouter()


class TeamOut(BaseModel):
    id: int
    abbr: str
    name: str


class TeamGameOut(BaseModel):
    game_id: str
    date: str
    home_team: str
    away_team: str
    home_points: int | None
    away_points: int | None
    status: str
    is_home: bool
    won: bool | None
    margin: int | None


class FormBucket(BaseModel):
    """A team's record and scoring over a slice of games."""

    games: int
    wins: int
    losses: int
    win_rate: float
    pts_for: float
    pts_against: float
    margin: float


class TeamDetail(BaseModel):
    abbr: str
    name: str
    city: str | None
    conference: str | None
    division: str | None

    season: int | None
    """Season the stats below cover; ``None`` means all seasons combined."""
    seasons: list[int]
    """Seasons this team has games in, newest first."""

    overall: FormBucket
    home: FormBucket
    away: FormBucket
    last10: FormBucket

    streak: str | None
    recent: list[TeamGameOut]
    upcoming: list[TeamGameOut]


def _bucket(rows: list[dict]) -> FormBucket:
    """Fold a list of per-game results into a record + scoring summary."""
    played = [r for r in rows if r["won"] is not None]
    n = len(played)
    if n == 0:
        return FormBucket(
            games=0, wins=0, losses=0, win_rate=0.0,
            pts_for=0.0, pts_against=0.0, margin=0.0,
        )
    wins = sum(1 for r in played if r["won"])
    pts_for = sum(r["pts_for"] for r in played) / n
    pts_against = sum(r["pts_against"] for r in played) / n
    return FormBucket(
        games=n,
        wins=wins,
        losses=n - wins,
        win_rate=round(wins / n, 4),
        pts_for=round(pts_for, 1),
        pts_against=round(pts_against, 1),
        margin=round(pts_for - pts_against, 1),
    )


def _streak(rows: list[dict]) -> str | None:
    """Current run, e.g. ``W3`` or ``L2``. Rows must be newest-first."""
    played = [r for r in rows if r["won"] is not None]
    if not played:
        return None
    first = played[0]["won"]
    count = 0
    for r in played:
        if r["won"] != first:
            break
        count += 1
    return f"{'W' if first else 'L'}{count}"


@router.get("/teams", response_model=list[TeamOut])
def list_teams(db: Session = Depends(get_db)) -> list[TeamOut]:
    """Return all known teams from the database."""
    teams = db.execute(select(Team).order_by(Team.abbr)).scalars().all()
    return [TeamOut(id=t.id, abbr=t.abbr, name=t.name) for t in teams]


@router.get("/teams/{abbr}", response_model=TeamDetail)
def team_detail(
    abbr: str,
    season: int | None = Query(
        default=None,
        description="Season start year; defaults to the team's latest season",
    ),
    all_seasons: bool = Query(
        default=False,
        description="Combine every season instead of using the latest one",
    ),
    db: Session = Depends(get_db),
) -> TeamDetail:
    """Profile for one team: record, splits, streak, and schedule.

    Without ``season`` the latest season is used, because combining seasons
    mixes eras and makes the record misleading. Pass ``all_seasons=true`` for
    the combined view. An explicit ``season`` wins over the default.
    """
    team = db.scalar(select(Team).where(Team.abbr == abbr.upper()))
    if team is None:
        raise HTTPException(status_code=404, detail=f"unknown team '{abbr}'")

    team_games = select(Game).where(
        (Game.home_team_id == team.id) | (Game.away_team_id == team.id)
    )
    seasons = [
        int(s)
        for s in db.execute(
            select(Game.season)
            .where(
                (Game.home_team_id == team.id) | (Game.away_team_id == team.id),
                Game.season.is_not(None),
            )
            .distinct()
            .order_by(Game.season.desc())
        ).scalars()
    ]

    if all_seasons:
        season = None
    elif season is None and seasons:
        season = seasons[0]

    stmt = team_games
    if season is not None:
        stmt = stmt.where(Game.season == season)

    games = (
        db.execute(stmt.order_by(Game.game_date.desc(), Game.id.desc()))
        .scalars()
        .all()
    )

    rows: list[dict] = []
    for g in games:
        is_home = g.home_team_id == team.id
        pts_for = g.home_points if is_home else g.away_points
        pts_against = g.away_points if is_home else g.home_points
        finished = g.status == "final" and pts_for is not None and pts_against is not None
        rows.append(
            {
                "game": g,
                "is_home": is_home,
                "pts_for": pts_for or 0,
                "pts_against": pts_against or 0,
                "won": (pts_for > pts_against) if finished else None,
                "margin": (pts_for - pts_against) if finished else None,
            }
        )

    def to_out(r: dict) -> TeamGameOut:
        g: Game = r["game"]
        return TeamGameOut(
            game_id=g.nba_game_id,
            date=g.game_date.isoformat(),
            home_team=g.home_team.abbr,
            away_team=g.away_team.abbr,
            home_points=g.home_points,
            away_points=g.away_points,
            status=g.status,
            is_home=r["is_home"],
            won=r["won"],
            margin=r["margin"],
        )

    played = [r for r in rows if r["won"] is not None]
    upcoming = [r for r in rows if r["game"].status == "scheduled"]
    # Upcoming should read soonest-first; the query is newest-first.
    upcoming.sort(key=lambda r: r["game"].game_date)

    return TeamDetail(
        abbr=team.abbr,
        name=team.name,
        city=team.city,
        conference=team.conference,
        division=team.division,
        season=season,
        seasons=seasons,
        overall=_bucket(played),
        home=_bucket([r for r in played if r["is_home"]]),
        away=_bucket([r for r in played if not r["is_home"]]),
        last10=_bucket(played[:10]),
        streak=_streak(played),
        recent=[to_out(r) for r in played[:10]],
        upcoming=[to_out(r) for r in upcoming[:5]],
    )
