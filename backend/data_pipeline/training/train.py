"""Train and persist the XGBoost home-win probability model.

The orchestrator that ties the pipeline together:

1. Build the supervised :class:`Dataset` from the database.
2. Split it chronologically (latest games held out as test).
3. Fit an ``XGBClassifier`` with early stopping on that held-out split.
4. Record accuracy / log-loss / ROC AUC + feature importances.
5. Persist a versioned :class:`ModelArtifact`.

Run from ``backend/``::

    python -m data_pipeline.training.train --season 2023
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import UTC, datetime

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score

from app.core.config import settings
from app.db.session import SessionLocal
from data_pipeline.features.build import Dataset, build_dataset
from data_pipeline.training.model import ModelArtifact
from data_pipeline.training.split import Split, split_by_time


@dataclass
class EvalReport:
    """Evaluation summary for a trained model."""

    version: str
    n_train: int
    n_test: int
    accuracy: float
    log_loss: float
    roc_auc: float | None
    feature_importance: dict[str, float]

    def summary_line(self) -> str:
        auc = f"{self.roc_auc:.3f}" if self.roc_auc is not None else "n/a"
        return (
            f"acc={self.accuracy:.3f} log_loss={self.log_loss:.3f} "
            f"auc={auc} (train={self.n_train}, test={self.n_test})"
        )


DEFAULT_MODEL_PARAMS: dict = {
    "objective": "binary:logistic",
    "eval_metric": "logloss",
    "tree_method": "hist",
    "n_estimators": 300,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.9,
    "colsample_bytree": 0.9,
    "early_stopping_rounds": 20,
}


def _coerce_dataset(dataset):
    """Return a copy with all feature columns numeric and non-degenerate.

    Box-score metric columns can arrive as ``object`` (mixed with NaN) or be
    entirely null. We coerce every feature to numeric and drop columns that are
    all-NaN so the trainer never hands XGBoost an invalid dtype and the saved
    ``feature_columns`` only contains real signal.
    """
    df = dataset.df.copy()
    kept: list[str] = []
    for col in dataset.feature_columns:
        series = pd.to_numeric(df[col], errors="coerce")
        if series.notna().any():
            df[col] = series
            kept.append(col)
        else:
            df = df.drop(columns=[col])
    return df, kept


def _fit_xgb(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_eval: pd.DataFrame,
    y_eval: pd.Series,
    params: dict | None,
) -> xgb.XGBClassifier:
    merged = {**DEFAULT_MODEL_PARAMS, **(params or {})}
    model = xgb.XGBClassifier(**merged)
    model.fit(X_train, y_train, eval_set=[(X_eval, y_eval)], verbose=False)
    return model


def _evaluate(
    model: xgb.XGBClassifier, X_test: pd.DataFrame, y_test: pd.Series,
    feature_columns: list[str],
) -> tuple[float, float, float | None, dict[str, float]]:
    proba = model.predict_proba(X_test)[:, 1]
    accuracy = float(accuracy_score(y_test, (proba > 0.5).astype(int)))
    ll = float(log_loss(y_test, proba))
    auc: float | None = None
    if len(np.unique(y_test)) > 1:
        auc = float(roc_auc_score(y_test, proba))
    importance = dict(zip(feature_columns, model.feature_importances_.astype(float), strict=True))
    return accuracy, ll, auc, importance


def train_model(
    session,
    seasons: list[int] | None = None,
    window: int = 5,
    test_frac: float = 0.2,
    params: dict | None = None,
    splitter=split_by_time,
) -> EvalReport:
    """Build, split, fit, evaluate, and persist a model; return its report."""
    dataset = build_dataset(session, seasons=seasons, window=window)
    if dataset.df.empty:
        raise ValueError("no game rows to train on — ingest/backfill data first")

    # Coerce source features to numeric and drop all-null columns, so what we
    # train on equals what we record/serve. Rebuild the Dataset around the kept
    # subset so splitting and artifact metadata both use the same columns.
    df, kept = _coerce_dataset(dataset)
    dataset = Dataset(df=df, feature_columns=kept, target_column=dataset.target_column)

    if len(dataset.df) < 10:
        raise ValueError("too few games to split meaningfully; want >= 10")

    split: Split = splitter(dataset, test_frac=test_frac)
    if split.X_train.empty or split.X_test.empty:
        raise ValueError("chronological split produced an empty train/test side")

    model = _fit_xgb(split.X_train, split.y_train, split.X_test, split.y_test, params)
    accuracy, ll, auc, importance = _evaluate(model, split.X_test, split.y_test,
                                              dataset.feature_columns)

    version = (
        f"{settings.model_version}-"
        f"{datetime.now(UTC):%Y%m%d%H%M%S}"
    )

    report = EvalReport(
        version=version,
        n_train=len(split.X_train),
        n_test=len(split.X_test),
        accuracy=accuracy,
        log_loss=ll,
        roc_auc=auc,
        feature_importance=importance,
    )

    artifact = ModelArtifact(
        model=model,
        feature_columns=list(dataset.feature_columns),
        version=report.version,
        metrics={
            "accuracy": accuracy,
            "log_loss": ll,
            "roc_auc": auc,
        },
    )
    artifact.save()
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train the PaLaro home-win model")
    parser.add_argument("--season", action="append", dest="seasons", type=int,
                        help="Season year(s) to train on, e.g. 2023 (repeatable)")
    parser.add_argument("--window", type=int, default=5,
                        help="Rolling window size for form features")
    parser.add_argument("--test-frac", type=float, default=0.2,
                        help="Chronological held-out fraction for evaluation")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    session = SessionLocal()
    try:
        report = train_model(session, seasons=args.seasons,
                             window=args.window, test_frac=args.test_frac)
        print(f"trained model v{report.version}: {report.summary_line()}")
        top = sorted(report.feature_importance.items(), key=lambda kv: -kv[1])[:10]
        print("top features:")
        for name, val in top:
            print(f"  {name:<24} {val:.3f}")
        print(f"saved -> {settings.model_artifact_path}")
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
