"""Tests for the prediction service and /predict endpoint.

Covers input alignment, the Wilson confidence interval, the model-backed
probability, and HTTP error mapping (400 missing feature, 503 no artifact).
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app
from app.models import Game, Team
from app.services.predictor import (
    FeatureMismatchError,
    PredictRequest,
    aligned_feature_frame,
)
from data_pipeline.features.build import build_dataset
from data_pipeline.training.train import train_model


def _add_team(session, nba_id: int, abbr: str) -> int:
    t = Team(nba_id=nba_id, name=f"Team {abbr}", abbr=abbr, city="City", conference=None)
    session.add(t)
    session.flush()
    return t.id


def _seed_games(db_session, n: int = 60) -> None:
    a, b, c = (_add_team(db_session, i, abbr)
               for i, abbr in enumerate(["AAA", "BBB", "CCC"], start=1))
    teams = [a, b, c]
    base = date(2023, 10, 1)
    for k in range(n):
        home, away = teams[k % 3], teams[(k + 1) % 3]
        home_won = (k % 2) == 0
        home_pts, away_pts = (105, 98) if home_won else (98, 105)
        db_session.add(
            Game(
                nba_game_id=f"G{k}", season=2023, game_date=base + timedelta(days=k),
                status="final", home_team_id=home, away_team_id=away,
                home_points=home_pts, away_points=away_pts,
            )
        )
    db_session.commit()


@pytest.fixture
def trained_artifact(db_session, tmp_path, monkeypatch):
    """Save a real trained artifact to a temp location and point settings at it."""
    model_p = tmp_path / "model.ubj"
    feat_p = tmp_path / "feature_columns.json"
    monkeypatch.setattr(settings, "model_artifact_path", str(model_p))
    monkeypatch.setattr(settings, "feature_columns_path", str(feat_p))
    _seed_games(db_session)
    train_model(db_session, seasons=[2023], params={"n_estimators": 50})
    return db_session


def _request_payload(db_session, drop: str | None = None) -> dict:
    dataset = build_dataset(db_session)
    features = {c: 0.5 for c in dataset.feature_columns}
    if drop:
        features.pop(drop)
    return {"game_id": "G1", "home_team": "AAA", "away_team": "BBB", "features": features}


def test_aligned_feature_frame_reorders_and_ignores_extras() -> None:
    frame = aligned_feature_frame({"b": 2.0, "extra": 9.0, "a": 1.0}, ["a", "b"])
    assert list(frame.columns) == ["a", "b"]
    assert frame.iloc[0].to_dict() == {"a": 1.0, "b": 2.0}


def test_aligned_feature_frame_rejects_missing() -> None:
    with pytest.raises(FeatureMismatchError):
        aligned_feature_frame({"a": 1.0}, ["a", "b"])


def test_predict_service_returns_sane_probability(trained_artifact) -> None:
    db = trained_artifact
    req = PredictRequest(**_request_payload(db))
    from app.services.predictor import predict

    resp = predict(req)
    assert 0.0 <= resp.home_win_prob <= 1.0
    lo, hi = resp.confidence_interval
    assert lo <= resp.home_win_prob <= hi
    # The trainer stamps a UTC build suffix onto the configured base version.
    assert resp.model_version.startswith(settings.model_version)

    # Reorders consistently with the trained feature list (no exception).
    shuffled = {**req.features}
    resp2 = predict(PredictRequest(**{**_request_payload(db), "features": shuffled}))
    assert resp2.home_win_prob == resp.home_win_prob


def test_predict_endpoint_ok(trained_artifact) -> None:
    client = TestClient(create_app())
    r = client.post("/api/v1/predict", json=_request_payload(trained_artifact))
    assert r.status_code == 200
    body = r.json()
    assert body["game_id"] == "G1"
    assert 0.0 <= body["home_win_prob"] <= 1.0
    lo, hi = body["confidence_interval"]
    assert lo <= body["home_win_prob"] <= hi


def test_predict_endpoint_missing_feature_400(trained_artifact) -> None:
    dataset = build_dataset(trained_artifact)
    payload = _request_payload(trained_artifact, drop=dataset.feature_columns[0])
    client = TestClient(create_app())
    r = client.post("/api/v1/predict", json=payload)
    assert r.status_code == 400
    assert "missing required feature" in r.json()["detail"]


def test_predict_endpoint_no_artifact_503(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "model_artifact_path", str(tmp_path / "nope.ubj"))
    payload = {"game_id": "G", "home_team": "A", "away_team": "B", "features": {"x": 1.0}}
    client = TestClient(create_app())
    r = client.post("/api/v1/predict", json=payload)
    assert r.status_code == 503
