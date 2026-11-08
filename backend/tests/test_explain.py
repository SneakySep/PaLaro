"""Tests for per-prediction feature attribution."""

from __future__ import annotations

import pandas as pd
import pytest

from app.services.explain import FEATURE_LABELS, _sigmoid, explain
from data_pipeline.features.schemas import FEATURE_COLUMNS
from data_pipeline.training.train import train_model


def _seed_games(session, n: int = 80) -> None:
    from datetime import date, timedelta

    from app.models import Game, Team

    teams = []
    for i, abbr in enumerate(["AAA", "BBB", "CCC"], start=1):
        t = Team(nba_id=i, name=f"Team {abbr}", abbr=abbr, city="City", conference=None)
        session.add(t)
        session.flush()
        teams.append(t.id)

    base = date(2023, 10, 1)
    for k in range(n):
        home, away = teams[k % 3], teams[(k + 1) % 3]
        home_won = (k % 2) == 0
        hp, ap = (105, 98) if home_won else (98, 105)
        session.add(
            Game(
                nba_game_id=f"G{k}", season=2023, game_date=base + timedelta(days=k),
                status="final", home_team_id=home, away_team_id=away,
                home_points=hp, away_points=ap,
            )
        )
    session.commit()


@pytest.fixture
def artifact(db_session, tmp_path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "model_artifact_path", str(tmp_path / "m.ubj"))
    monkeypatch.setattr(settings, "feature_columns_path", str(tmp_path / "f.json"))
    _seed_games(db_session)
    train_model(db_session, seasons=[2023], params={"n_estimators": 40})
    from app.services.predictor import get_artifact

    return get_artifact()


def _frame(artifact) -> pd.DataFrame:
    row = {c: 0.5 for c in artifact.feature_columns}
    row.update(
        {
            "home_roll_pts_for": 118.0,
            "home_roll_pts_against": 110.0,
            "home_roll_margin": 8.0,
            "home_roll_win_rate": 0.8,
            "away_roll_pts_for": 112.0,
            "away_roll_pts_against": 114.0,
            "away_roll_margin": -2.0,
            "away_roll_win_rate": 0.4,
            "home_rest_days": 2,
            "away_rest_days": 1,
        }
    )
    return pd.DataFrame([row], columns=artifact.feature_columns)


def test_explain_returns_ranked_contributions(artifact) -> None:
    frame = _frame(artifact)
    proba = float(artifact.model.predict_proba(frame)[0, 1])
    contribs = explain(artifact, frame, proba, top_n=6)

    assert 1 <= len(contribs) <= 6
    # Sorted by absolute impact, largest first.
    magnitudes = [abs(c.impact) for c in contribs]
    assert magnitudes == sorted(magnitudes, reverse=True)


def test_contributions_are_probability_sized(artifact) -> None:
    """Every impact must be a plausible probability delta, not a raw log-odds."""
    frame = _frame(artifact)
    proba = float(artifact.model.predict_proba(frame)[0, 1])
    for c in explain(artifact, frame, proba, top_n=25):
        assert -1.0 <= c.impact <= 1.0


def test_contributions_have_labels_and_groups(artifact) -> None:
    frame = _frame(artifact)
    proba = float(artifact.model.predict_proba(frame)[0, 1])
    for c in explain(artifact, frame, proba, top_n=25):
        assert c.label
        assert c.group
        assert c.feature in artifact.feature_columns


def test_every_feature_column_has_a_label() -> None:
    """A new feature must not silently fall through to a raw snake_case name."""
    missing = [c for c in FEATURE_COLUMNS if c not in FEATURE_LABELS]
    assert missing == []


def test_sigmoid_is_stable() -> None:
    assert _sigmoid(0.0) == pytest.approx(0.5)
    assert _sigmoid(1000.0) == pytest.approx(1.0)
    assert _sigmoid(-1000.0) == pytest.approx(0.0)


def test_predict_endpoint_includes_explanations(db_session, tmp_path, monkeypatch) -> None:
    from fastapi.testclient import TestClient

    from app.core.config import settings
    from app.main import create_app

    monkeypatch.setattr(settings, "model_artifact_path", str(tmp_path / "m2.ubj"))
    monkeypatch.setattr(settings, "feature_columns_path", str(tmp_path / "f2.json"))
    _seed_games(db_session)
    train_model(db_session, seasons=[2023], params={"n_estimators": 40})

    from app.services import predictor as predictor_mod

    predictor_mod._artifact_cache.clear()

    from data_pipeline.features.build import build_dataset

    dataset = build_dataset(db_session)
    features = {c: 0.5 for c in dataset.feature_columns}
    payload = {
        "game_id": "G1",
        "home_team": "AAA",
        "away_team": "BBB",
        "features": features,
    }

    client = TestClient(create_app())
    r = client.post("/api/v1/predict", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert "explanations" in body
    assert len(body["explanations"]) > 0
    first = body["explanations"][0]
    assert set(first) == {"feature", "label", "group", "value", "impact"}
