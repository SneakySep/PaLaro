"""Advanced per-game team metrics derived from box-score player lines.

These are optionally available and scale with how much ``player_game_stats``
has been backfilled. They are joined onto feature rows per (game, team) side
and are simply absent (NULL) when no box score exists for a game.
"""

from __future__ import annotations

import pandas as pd


def team_box_metrics(stat_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate per-player box-score lines into per-(game, team) metrics.

    Expects ``stat_df`` with columns ``game_id``, ``team_id`` and the counting
    stats ``fg_made/fg_att/fg3_made/fg3_att/ft_made/ft_att`` plus
    ``points/assists/turnovers/rebounds``. Returns one row per (game, team)
    with:

    * ``team_efg`` — effective field-goal % = (FGM + 0.5*3PM) / FGA
    * ``team_ts``  — true shooting % = PTS / (2*(FGA + 0.44*FTA))
    * ``team_pts``, ``team_ast``, ``team_tov``, ``team_reb`` — team totals

    Rates are computed on team totals (not averaged per player), matching how
    the league publishes them.
    """
    agg = stat_df.groupby(["game_id", "team_id"], as_index=False).agg(
        fg_made=("fg_made", "sum"),
        fg_att=("fg_att", "sum"),
        fg3_made=("fg3_made", "sum"),
        fg3_att=("fg3_att", "sum"),
        ft_made=("ft_made", "sum"),
        ft_att=("ft_att", "sum"),
        points=("points", "sum"),
        assists=("assists", "sum"),
        turnovers=("turnovers", "sum"),
        rebounds=("rebounds", "sum"),
    )

    fg_den = agg["fg_att"].where(agg["fg_att"] > 0)
    agg["team_efg"] = (agg["fg_made"] + 0.5 * agg["fg3_made"]) / fg_den

    ts_den = (2 * (agg["fg_att"] + 0.44 * agg["ft_att"])).where(
        (agg["fg_att"] + 0.44 * agg["ft_att"]) > 0
    )
    agg["team_ts"] = agg["points"] / ts_den

    agg = agg.rename(
        columns={
            "points": "team_pts",
            "assists": "team_ast",
            "turnovers": "team_tov",
            "rebounds": "team_reb",
        }
    )
    return agg


#: Per-game-team metrics we lag into rolling features (team_pts is redundant with
#: the existing rolling point totals, so it is omitted).
_ROLL_TEAM_METRICS = ("team_efg", "team_ts", "team_ast", "team_tov", "team_reb")


def team_rolling_box(
    metrics: pd.DataFrame,
    appearances: pd.DataFrame,
    window: int = 5,
) -> pd.DataFrame:
    """Zero-leakage trailing box metrics for every (game, team) appearance.

    :param metrics: per-(``game_id``, ``team_id``) output of :func:`team_box_metrics`.
    :param appearances: one row per (``game_id``, ``team_id``) for *every* team
        appearance, with a ``game_date`` column. Includes games that lack their
        own box score so their trailing features still come from prior games.
    :param window: number of prior games to average.

    For each team it lags each box metric by one game (``shift(1)``) and averages
    over the trailing window, so a game's *own* box score never enters its own
    features — no target leakage. Returns ``appearances`` plus ``roll_efg``,
    ``roll_ts``, ``roll_ast``, ``roll_tov``, ``roll_reb`` columns.
    """
    m = appearances.merge(metrics, on=["game_id", "team_id"], how="left")

    frames: list[pd.DataFrame] = []
    for _, group in m.groupby("team_id", sort=False):
        g = group.sort_values("game_date").copy()
        for metric in _ROLL_TEAM_METRICS:
            short = metric.removeprefix("team_")
            g[f"roll_{short}"] = (
                g[metric].shift(1).rolling(window, min_periods=1).mean()
            )
        frames.append(g)
    return pd.concat(frames, ignore_index=True)
