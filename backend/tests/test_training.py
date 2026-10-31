"""End-to-end tests for the XGBoost training pipeline (split + train + model)."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.core.config import settings
from app.models import Game, Team
from data_pipeline.features.build import build_dataset
from data_pipeline.training.model import ModelArtifact
from data_pipeline.training.split import Split, split_by_time
from data_pipeline.training.train import train_model


def _add_team(session, nba_id: int, abbr: str) -> int:
    t = Team(nba_id=nba_id, name=f"Team {abbr}", abbr=abbr, city="City", conference=None)
    session.add(t)
    session.flush()
    return t.id


def _seed_games(db_session, n: int = 60) -> None:
    """Round-robin schedule across 3 teams with a strict alternating result."""
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
def artifact_paths(tmp_path, monkeypatch):
    model_p = tmp_path / "model.ubj"
    features_p = tmp_path / "feature_columns.json"
    monkeypatch.setattr(settings, "model_artifact_path", str(model_p))
    monkeypatch.setattr(settings, "feature_columns_path", str(features_p))
    return model_p, features_p


def test_split_by_time_is_leakage_free(db_session) -> None:
    _seed_games(db_session)
    dataset = build_dataset(db_session)
    split: Split = split_by_time(dataset, test_frac=0.2)

    assert not split.X_test.empty
    # Every test game is on or after every train game (no future leakage).
    assert split.test_dates.max() >= split.train_dates.min()
    assert (split.test_dates >= split.train_dates.max()).all()
    # Train and test partition the rows with no overlap.
    train_idx = set(split.X_train.index)
    test_idx = set(split.X_test.index)
    assert train_idx.isdisjoint(test_idx)
    assert len(train_idx) + len(test_idx) == len(dataset.df)


def test_split_by_time_column_contract(db_session) -> None:
    _seed_games(db_session)
    dataset = build_dataset(db_session)
    split = split_by_time(dataset, test_frac=0.3)
    assert list(split.X_train.columns) == dataset.feature_columns
    assert len(split.X_test.columns) == len(dataset.feature_columns)
    assert len(split.y_train) == len(split.X_train)


def test_split_rejects_bad_frac(db_session) -> None:
    _seed_games(db_session)
    dataset = build_dataset(db_session)
    with pytest.raises(ValueError):
        split_by_time(dataset, test_frac=1.0)
    with pytest.raises(ValueError):
        split_by_time(dataset, test_frac=0.0)


def test_train_model_end_to_end_and_persists(db_session, artifact_paths) -> None:
    _seed_games(db_session)
    report = train_model(db_session, seasons=[2023], params={"n_estimators": 100})

    assert report.n_train > 0 and report.n_test > 0
    assert 0.0 <= report.accuracy <= 1.0
    assert report.log_loss > 0.0
    assert set(report.feature_importance) >= set(build_dataset(db_session).feature_columns)

    # Artifact round-trips and carries identical feature columns.
    model_path, features_path = artifact_paths
    assert model_path.exists() and features_path.exists()
    loaded = ModelArtifact.load(model_path, features_path)
    assert loaded.version == report.version
    assert loaded.feature_columns == build_dataset(db_session).feature_columns
    assert loaded.metrics["accuracy"] == report.accuracy


def test_train_model_empty_data_raises(db_session) -> None:
    with pytest.raises(ValueError):
        train_model(db_session, seasons=[1999])
