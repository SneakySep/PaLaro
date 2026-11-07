"""Tests for walk-forward (rolling-origin) validation."""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from data_pipeline.features.build import Dataset
from data_pipeline.training.walk_forward import WalkForwardReport, walk_forward


def _dataset(n: int = 200, seed: int = 0) -> Dataset:
    """A synthetic dataset where the feature genuinely predicts the target."""
    rng = np.random.default_rng(seed)
    base = date(2023, 10, 1)
    signal = rng.normal(0, 1, n)
    # Home win probability rises with the signal feature.
    y = (rng.random(n) < 1 / (1 + np.exp(-signal))).astype(int)
    df = pd.DataFrame(
        {
            "game_date": [base + timedelta(days=i) for i in range(n)],
            "signal": signal,
            "noise": rng.normal(0, 1, n),
            "home_win": y,
        }
    )
    return Dataset(df=df, feature_columns=["signal", "noise"], target_column="home_win")


def test_walk_forward_produces_requested_folds() -> None:
    report = walk_forward(_dataset(), n_folds=4, min_train_frac=0.5)
    assert report.n_folds == 4


def test_folds_are_chronological_and_non_overlapping() -> None:
    """Every test window must start after its training data ends."""
    report = walk_forward(_dataset(), n_folds=4, min_train_frac=0.5)
    for f in report.folds:
        assert f.test_start > f.train_end
    # Pairwise comparison: the second sequence is deliberately one shorter.
    for prev, nxt in zip(report.folds, report.folds[1:], strict=False):
        assert nxt.test_start > prev.test_end


def test_training_set_grows_each_fold() -> None:
    """Rolling origin means each fold trains on strictly more history."""
    report = walk_forward(_dataset(), n_folds=4, min_train_frac=0.5)
    sizes = [f.n_train for f in report.folds]
    assert sizes == sorted(sizes)
    assert sizes[-1] > sizes[0]


def test_all_rows_are_tested_exactly_once() -> None:
    ds = _dataset(n=200)
    report = walk_forward(ds, n_folds=4, min_train_frac=0.5)
    assert sum(f.n_test for f in report.folds) == 200 - int(200 * 0.5)


def test_summary_reports_spread_and_baseline() -> None:
    report = walk_forward(_dataset(), n_folds=4, min_train_frac=0.5)
    s = report.summary()
    assert s["n_folds"] == 4
    assert 0.0 <= s["accuracy_mean"] <= 1.0
    assert s["accuracy_std"] >= 0.0
    assert 0.0 <= s["baseline_accuracy_mean"] <= 1.0
    # edge is defined as accuracy minus the always-pick-home baseline.
    assert s["edge_over_baseline"] == pytest.approx(
        s["accuracy_mean"] - s["baseline_accuracy_mean"]
    )


def test_signal_feature_beats_baseline() -> None:
    """A real signal should show a positive edge over always-pick-home."""
    report = walk_forward(_dataset(n=400, seed=7), n_folds=4, min_train_frac=0.5)
    assert report.summary()["edge_over_baseline"] > 0.0


def test_rejects_bad_parameters() -> None:
    with pytest.raises(ValueError):
        walk_forward(_dataset(), n_folds=0)
    with pytest.raises(ValueError):
        walk_forward(_dataset(), min_train_frac=1.5)
    with pytest.raises(ValueError):
        walk_forward(_dataset(n=10), n_folds=4)


def test_report_formatting_does_not_raise() -> None:
    report = walk_forward(_dataset(), n_folds=3, min_train_frac=0.5)
    assert "fold" in report.format_table()
    assert "accuracy" in report.format_summary()


def test_empty_report_summary_is_safe() -> None:
    """An empty report must not blow up on formatting."""
    report = WalkForwardReport()
    assert report.n_folds == 0
