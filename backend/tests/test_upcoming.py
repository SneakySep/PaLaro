"""Tests for upcoming-game predictions (feature assembly + /predict/upcoming).

Seeds a deterministic mini-history (alternating AAA/BBB results) so every
rolling feature, rest day, and cross-feature can be asserted exactly, and
stubs the model artifact so no real XGBoost training is needed.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import create_app
from app.models import Game, Team
from app.services import predictor as predictor_mod
from app.services import upcoming as upcoming_mod
from app.services.upcoming import (
    _features_for_game,
    _team_current_form,
    upcoming_predictions,
)
from data_pipeline.features.build import load_final_games, team_appearances
from data_pipeline.features.schemas import FEATURE_COLUMNS


class _StubModel:
    """Deterministic stand-in for the trained XGBClassifier."""

    def predict_proba(self, frame):
        return np.array([[0.3, 0.7]])


def _stub_artifact(monkeypatch: pytest.MonkeyPatch) -> None:
    artifact = type(
        "StubArtifact",
        (),
        {
            "model": _StubModel(),
            "feature_columns": list(FEATURE_COLUMNS),
            "version": "test",
            "metrics": {},
        },
    )()
    # ``upcoming`` binds ``get_artifact`` at import time, so patching the
    # predictor module alone is not enough — patch both references.
    monkeypatch.setattr(predictor_mod, "get_artifact", lambda: artifact)
    monkeypatch.setattr(upcoming_mod, "get_artifact", lambda: artifact)


def _add_team(session, abbr: str, nba_id: int) -> int:
    t = Team(nba_id=nba_id, name=f"Team {abbr}", abbr=abbr, city="City",
             conference=None)
    session.add(t)
    session.flush()
    return t.id


def _seed(db_session, n: int = 6, base: date | None = None) -> tuple[int, int]:
    """Six finals: AAA/BBB alternate home court with fixed scores.

    AAA's trailing form (window 5, lagged): pts_for 102.0, pts_against 92.0,
    margin +10.0, win rate 1.0 — BBB is the exact mirror.

    ``base`` sets the first game date. Defaults to a fixed 2023 date for
    deterministic assertions; pass a recent date when the code under test
    computes rest days against the real ``date.today()``.
    """
    home_id = _add_team(db_session, "AAA", 1)
    away_id = _add_team(db_session, "BBB", 2)
    base = base or date(2023, 10, 1)
    for k in range(n):
        a_home = k % 2 == 0  # AAA hosts on even days
        home, away = (home_id, away_id) if a_home else (away_id, home_id)
        home_pts, away_pts = (100, 90) if a_home else (95, 105)
        db_session.add(
            Game(
                nba_game_id=f"G{k}", season=2023, game_date=base + timedelta(days=k),
                status="final", home_team_id=home, away_team_id=away,
                home_points=home_pts, away_points=away_pts,
            )
        )
    db_session.commit()
    return home_id, away_id


def test_team_current_form_matches_seed_math(db_session) -> None:
    home_id, away_id = _seed(db_session)
    games = load_final_games(db_session, None)
    form = _team_current_form(team_appearances(games), window=5)

    # AAA appeared in 6 finals: pts_for 100,105,100,105,100,105 — the lagged
    # last-5 average is 102.0; BBB is the mirror image.
    aaa = form.loc[home_id]
    assert aaa["roll_pts_for"] == pytest.approx(102.0)
    assert aaa["roll_pts_against"] == pytest.approx(92.0)
    assert aaa["roll_margin"] == pytest.approx(10.0)
    assert aaa["roll_win_rate"] == pytest.approx(1.0)
    assert aaa["game_date"].date() == date(2023, 10, 6)

    bbb = form.loc[away_id]
    assert bbb["roll_pts_for"] == pytest.approx(92.0)
    assert bbb["roll_pts_against"] == pytest.approx(102.0)
    assert bbb["roll_win_rate"] == pytest.approx(0.0)


def test_features_for_game_exact_values(db_session) -> None:
    home_id, away_id = _seed(db_session)
    games = load_final_games(db_session, None)
    form = _team_current_form(team_appearances(games), window=5)
    game = Game(
        nba_game_id="G6", season=2023, game_date=date(2023, 10, 8),
        status="scheduled", home_team_id=home_id, away_team_id=away_id,
    )

    features = _features_for_game(game, form, pd.DataFrame(), [], list(FEATURE_COLUMNS))

    assert features is not None
    assert features["home_roll_pts_for"] == pytest.approx(102.0)
    assert features["away_roll_pts_against"] == pytest.approx(102.0)
    assert features["off_off"] == pytest.approx(0.0)     # 102.0 - 102.0
    assert features["def_def"] == pytest.approx(0.0)     # 92.0 - 92.0
    assert features["home_rest_days"] == pytest.approx(2.0)  # 10-06 → 10-08
    assert features["away_rest_days"] == pytest.approx(2.0)
    assert features["rest_advantage"] == pytest.approx(0.0)
    assert features["home_b2b"] == 0.0
    assert features["away_b2b"] == 0.0

    # A slate one day after the last final is a back-to-back for both sides.
    b2b = Game(
        nba_game_id="G7", season=2023, game_date=date(2023, 10, 7),
        status="scheduled", home_team_id=home_id, away_team_id=away_id,
    )
    feats = _features_for_game(b2b, form, pd.DataFrame(), [], list(FEATURE_COLUMNS))
    assert feats["home_rest_days"] == pytest.approx(1.0)
    assert feats["home_b2b"] == 1.0
    assert feats["away_b2b"] == 1.0


def test_features_for_game_populates_box_metrics(db_session) -> None:
    """Regression: box columns for both sides must map onto the right side.

    ``box_columns`` contains home *and* away columns, so building the home side
    used to look up ``roll_away_roll_efg`` and raise KeyError. Every other test
    passed an empty ``box_form``, so this branch was never executed.
    """
    home_id, away_id = _seed(db_session)
    games = load_final_games(db_session, None)
    form = _team_current_form(team_appearances(games), window=5)
    game = Game(
        nba_game_id="G6", season=2023, game_date=date(2023, 10, 8),
        status="scheduled", home_team_id=home_id, away_team_id=away_id,
    )

    box_columns = [
        "home_roll_efg", "home_roll_ts", "away_roll_efg", "away_roll_ts",
    ]
    box_form = pd.DataFrame(
        {
            "roll_efg": [0.55, 0.51],
            "roll_ts": [0.60, 0.57],
        },
        index=pd.Index([home_id, away_id], name="team_id"),
    )

    features = _features_for_game(
        game, form, box_form, box_columns, list(FEATURE_COLUMNS) + box_columns
    )

    assert features is not None
    # Each side reads its own row, not the other team's.
    assert features["home_roll_efg"] == pytest.approx(0.55)
    assert features["home_roll_ts"] == pytest.approx(0.60)
    assert features["away_roll_efg"] == pytest.approx(0.51)
    assert features["away_roll_ts"] == pytest.approx(0.57)


def test_features_for_game_skips_stale_form(db_session) -> None:
    """A team whose last final game is ancient must not be scored.

    Regression: with only a 2023-24 season in the DB, every 2026 slate was
    scored with rest_days in the hundreds — far outside the 1-9 range the model
    was trained on — and the resulting probabilities were meaningless.
    """
    home_id, away_id = _seed(db_session)  # history ends 2023-10-06
    games = load_final_games(db_session, None)
    form = _team_current_form(team_appearances(games), window=5)
    game = Game(
        nba_game_id="G6", season=2026, game_date=date(2026, 11, 6),
        status="scheduled", home_team_id=home_id, away_team_id=away_id,
    )

    assert _features_for_game(game, form, pd.DataFrame(), [], list(FEATURE_COLUMNS)) is None


def test_features_for_game_allows_recent_form(db_session) -> None:
    """The same slate scores normally when the history is current."""
    home_id, away_id = _seed(db_session, base=date.today() - timedelta(days=6))
    games = load_final_games(db_session, None)
    form = _team_current_form(team_appearances(games), window=5)
    game = Game(
        nba_game_id="G6", season=2026, game_date=date.today() + timedelta(days=1),
        status="scheduled", home_team_id=home_id, away_team_id=away_id,
    )

    features = _features_for_game(game, form, pd.DataFrame(), [], list(FEATURE_COLUMNS))
    assert features is not None
    # Six games from today-6 to today-1, slate at today+1 -> 2 days of rest.
    assert features["home_rest_days"] == pytest.approx(2.0)


def test_features_for_game_skips_insufficient_history(db_session) -> None:
    home_id, away_id = _seed(db_session, n=2)  # < window → all rolling values NaN
    games = load_final_games(db_session, None)
    form = _team_current_form(team_appearances(games), window=5)
    game = Game(
        nba_game_id="G6", season=2023, game_date=date(2023, 10, 8),
        status="scheduled", home_team_id=home_id, away_team_id=away_id,
    )
    assert _features_for_game(game, form, pd.DataFrame(), [], list(FEATURE_COLUMNS)) is None


def test_upcoming_predictions_service(db_session, monkeypatch) -> None:
    home_id, away_id = _seed(db_session)
    _stub_artifact(monkeypatch)

    db_session.add(
        Game(nba_game_id="G6", season=2023, game_date=date(2023, 10, 8),
             status="scheduled", home_team_id=home_id, away_team_id=away_id)
    )
    # A "scheduled" date already covered by history and a live game are never scored.
    db_session.add(
        Game(nba_game_id="G7", season=2023, game_date=date(2023, 10, 6),
             status="scheduled", home_team_id=away_id, away_team_id=home_id)
    )
    db_session.add(
        Game(nba_game_id="G8", season=2023, game_date=date(2023, 10, 9),
             status="live", home_team_id=away_id, away_team_id=home_id)
    )
    # Outside the 7-day horizon.
    db_session.add(
        Game(nba_game_id="G9", season=2023, game_date=date(2023, 10, 20),
             status="scheduled", home_team_id=home_id, away_team_id=away_id)
    )
    db_session.commit()

    preds = upcoming_predictions(db_session, days=7, today=date(2023, 10, 7))
    assert [p.game_id for p in preds] == ["G6"]
    p = preds[0]
    assert p.home_team == "AAA"
    assert p.away_team == "BBB"
    assert p.game_date == date(2023, 10, 8)
    assert p.home_win_prob == pytest.approx(0.7)  # stub predict_proba
    assert p.model_version == "test"
    assert not hasattr(p, "confidence_interval")

    # Horizon grows with `days` (ordered by game_date).
    preds14 = upcoming_predictions(db_session, days=14, today=date(2023, 10, 7))
    assert [g.game_id for g in preds14] == ["G6", "G9"]


def test_upcoming_endpoint_ok(db_session, monkeypatch) -> None:
    # History must be recent: the service refuses to score a team whose last
    # final game is older than MAX_REST_DAYS, and the endpoint uses the real
    # date.today() as its horizon start.
    home_id, away_id = _seed(db_session, base=date.today() - timedelta(days=6))
    _stub_artifact(monkeypatch)
    slate = date.today() + timedelta(days=1)
    db_session.add(
        Game(nba_game_id="G6", season=2023, game_date=slate,
             status="scheduled", home_team_id=home_id, away_team_id=away_id)
    )
    db_session.commit()

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(app)
    r = client.get("/api/v1/predict/upcoming", params={"days": 7})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["game_id"] == "G6"
    assert body[0]["home_team"] == "AAA"
    assert body[0]["game_date"] == slate.isoformat()
    assert 0.0 <= body[0]["home_win_prob"] <= 1.0


def test_upcoming_endpoint_no_artifact_503(db_session, tmp_path, monkeypatch) -> None:
    from app.core.config import settings

    home_id, away_id = _seed(db_session)
    db_session.add(
        Game(nba_game_id="G6", season=2023, game_date=date(2023, 10, 8),
             status="scheduled", home_team_id=home_id, away_team_id=away_id)
    )
    db_session.commit()

    monkeypatch.setattr(settings, "model_artifact_path", str(tmp_path / "nope.ubj"))
    predictor_mod._artifact_cache.clear()

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(app)
    r = client.get("/api/v1/predict/upcoming")
    assert r.status_code == 503
