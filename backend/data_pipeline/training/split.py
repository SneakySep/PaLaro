"""Time-aware dataset splitting that prevents future leakage.

Sports predictions are a time series: a model that peeks at "today's" result
before predicting "today" leaks information. Instead of a random shuffle, we
sort all rows by game date and hold out the *latest* fraction as test. That way
every test game is chronologically after every training game, mirroring how the
model will actually be used.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from data_pipeline.features.build import Dataset


@dataclass
class Split:
    """Chronological train/test split of the feature matrix + target."""

    X_train: pd.DataFrame
    y_train: pd.Series
    X_test: pd.DataFrame
    y_test: pd.Series
    train_dates: pd.Series
    test_dates: pd.Series


def split_by_time(dataset: Dataset, test_frac: float = 0.2) -> Split:
    """Return a leakage-free split where test is chronologically after train.

    ``test_frac`` is the fraction of games (by date) held out for testing.
    Rows are ordered by ``game_date``, so ties keep their stable order and no
    shuffle is performed.
    """
    if not 0 < test_frac < 1:
        raise ValueError("test_frac must be strictly between 0 and 1")
    df = dataset.df.sort_values("game_date").reset_index(drop=True)
    cutoff = int(np.ceil(len(df) * (1 - test_frac)))
    train, test = df.iloc[:cutoff], df.iloc[cutoff:]
    return Split(
        X_train=train[dataset.feature_columns],
        y_train=train[dataset.target_column],
        X_test=test[dataset.feature_columns],
        y_test=test[dataset.target_column],
        train_dates=train["game_date"],
        test_dates=test["game_date"],
    )
