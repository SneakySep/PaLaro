"""Walk-forward (rolling-origin) validation for the PaLaro win model.

A single chronological split gives one number from one arbitrary cutoff. With a
few hundred test games the standard error on accuracy is around +/-3 points, so
one split cannot tell a real improvement from noise.

Walk-forward validation instead trains on everything before a cutoff, tests on
the games in the following window, then rolls the cutoff forward and repeats.
Every fold is leakage-free (test is always strictly after train), and the spread
across folds is the honest measure of how stable the model is.

Usage, from ``backend/``::

    python -m data_pipeline.training.walk_forward --season 2023 --season 2026
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score

from app.db.session import SessionLocal
from data_pipeline.features.build import Dataset, build_dataset
from data_pipeline.training.train import _coerce_dataset, _fit_xgb


@dataclass
class Fold:
    """One train/test window in the walk-forward sequence."""

    index: int
    train_end: pd.Timestamp
    test_start: pd.Timestamp
    test_end: pd.Timestamp
    n_train: int
    n_test: int
    accuracy: float
    log_loss: float
    roc_auc: float | None
    baseline_accuracy: float  # always-pick-home on this fold's test set


@dataclass
class WalkForwardReport:
    """Aggregate result across all folds."""

    folds: list[Fold] = field(default_factory=list)

    @property
    def n_folds(self) -> int:
        return len(self.folds)

    def _col(self, name: str) -> np.ndarray:
        return np.array([getattr(f, name) for f in self.folds], dtype=float)

    def summary(self) -> dict[str, float]:
        """Mean and spread of each metric across folds."""
        acc = self._col("accuracy")
        auc = np.array(
            [f.roc_auc for f in self.folds if f.roc_auc is not None], dtype=float
        )
        base = self._col("baseline_accuracy")
        return {
            "n_folds": float(self.n_folds),
            "accuracy_mean": float(acc.mean()),
            "accuracy_std": float(acc.std(ddof=1)) if len(acc) > 1 else 0.0,
            "accuracy_min": float(acc.min()),
            "accuracy_max": float(acc.max()),
            "log_loss_mean": float(self._col("log_loss").mean()),
            "roc_auc_mean": float(auc.mean()) if len(auc) else float("nan"),
            "roc_auc_std": float(auc.std(ddof=1)) if len(auc) > 1 else 0.0,
            "baseline_accuracy_mean": float(base.mean()),
            "edge_over_baseline": float(acc.mean() - base.mean()),
            "n_test_total": float(self._col("n_test").sum()),
        }

    def format_table(self) -> str:
        """Human-readable per-fold table."""
        lines = [
            f"{'fold':>4} {'test window':>25} {'n_train':>8} {'n_test':>7} "
            f"{'acc':>7} {'base':>7} {'auc':>7} {'logloss':>8}",
            "-" * 82,
        ]
        for f in self.folds:
            window = f"{f.test_start.date()} -> {f.test_end.date()}"
            auc = f"{f.roc_auc:.3f}" if f.roc_auc is not None else "  n/a"
            lines.append(
                f"{f.index:>4} {window:>25} {f.n_train:>8} {f.n_test:>7} "
                f"{f.accuracy:>7.3f} {f.baseline_accuracy:>7.3f} {auc:>7} "
                f"{f.log_loss:>8.3f}"
            )
        return "\n".join(lines)

    def format_summary(self) -> str:
        s = self.summary()
        return (
            f"folds={int(s['n_folds'])} test_games={int(s['n_test_total'])}\n"
            f"accuracy   {s['accuracy_mean']:.4f} +/- {s['accuracy_std']:.4f} "
            f"(min {s['accuracy_min']:.4f}, max {s['accuracy_max']:.4f})\n"
            f"baseline   {s['baseline_accuracy_mean']:.4f} (always pick home)\n"
            f"edge       {s['edge_over_baseline']:+.4f} over baseline\n"
            f"roc_auc    {s['roc_auc_mean']:.4f} +/- {s['roc_auc_std']:.4f}\n"
            f"log_loss   {s['log_loss_mean']:.4f}"
        )


def _metrics(y_true: pd.Series, proba: np.ndarray) -> tuple[float, float, float | None]:
    acc = float(accuracy_score(y_true, (proba > 0.5).astype(int)))
    ll = float(log_loss(y_true, proba))
    auc = float(roc_auc_score(y_true, proba)) if len(np.unique(y_true)) > 1 else None
    return acc, ll, auc


def walk_forward(
    dataset: Dataset,
    n_folds: int = 5,
    min_train_frac: float = 0.5,
    params: dict | None = None,
) -> WalkForwardReport:
    """Roll a train/test cutoff across ``dataset`` and score each fold.

    The first fold trains on ``min_train_frac`` of the rows (by date) and tests
    on the next slice; each subsequent fold moves the cutoff forward by one
    slice. Test windows never overlap and always follow their training data.

    Folds whose test window has a single class (all home wins or all losses)
    still count toward accuracy but contribute no ROC AUC.
    """
    if not 0 < min_train_frac < 1:
        raise ValueError("min_train_frac must be strictly between 0 and 1")
    if n_folds < 1:
        raise ValueError("n_folds must be >= 1")

    df = dataset.df.sort_values("game_date").reset_index(drop=True)
    n = len(df)
    if n < 20:
        raise ValueError(f"too few rows for walk-forward validation: {n}")

    first_train = int(n * min_train_frac)
    remaining = n - first_train
    if remaining < n_folds:
        raise ValueError(
            f"not enough rows after the first training window ({remaining}) "
            f"to form {n_folds} folds"
        )
    slice_size = remaining // n_folds

    report = WalkForwardReport()
    for i in range(n_folds):
        test_lo = first_train + i * slice_size
        test_hi = n if i == n_folds - 1 else test_lo + slice_size
        train_df = df.iloc[:test_lo]
        test_df = df.iloc[test_lo:test_hi]
        if test_df.empty or train_df.empty:
            continue

        X_train = train_df[dataset.feature_columns]
        y_train = train_df[dataset.target_column]
        X_test = test_df[dataset.feature_columns]
        y_test = test_df[dataset.target_column]
        if len(np.unique(y_train)) < 2:
            continue

        model = _fit_xgb(X_train, y_train, X_test, y_test, params)
        proba = model.predict_proba(X_test)[:, 1]
        acc, ll, auc = _metrics(y_test, proba)

        report.folds.append(
            Fold(
                index=i + 1,
                train_end=pd.Timestamp(train_df["game_date"].max()),
                test_start=pd.Timestamp(test_df["game_date"].min()),
                test_end=pd.Timestamp(test_df["game_date"].max()),
                n_train=len(train_df),
                n_test=len(test_df),
                accuracy=acc,
                log_loss=ll,
                roc_auc=auc,
                baseline_accuracy=float(y_test.mean()),
            )
        )

    if not report.folds:
        raise ValueError("no usable folds produced; check the dataset size")
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Walk-forward validation of the PaLaro home-win model"
    )
    parser.add_argument("--season", action="append", dest="seasons", type=int,
                        help="Season year(s), e.g. 2023 (repeatable)")
    parser.add_argument("--window", type=int, default=5,
                        help="Rolling window size for form features")
    parser.add_argument("--folds", type=int, default=5,
                        help="Number of walk-forward folds")
    parser.add_argument("--min-train-frac", type=float, default=0.5,
                        help="Fraction of rows in the first training window")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    session = SessionLocal()
    try:
        dataset = build_dataset(session, seasons=args.seasons, window=args.window)
        if dataset.df.empty:
            print("no rows to validate; ingest data first")
            return 1
        df, kept = _coerce_dataset(dataset)
        dataset = Dataset(df=df, feature_columns=kept, target_column=dataset.target_column)

        report = walk_forward(
            dataset, n_folds=args.folds, min_train_frac=args.min_train_frac
        )
        print(report.format_table())
        print()
        print(report.format_summary())
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
