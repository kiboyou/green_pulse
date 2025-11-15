"""Model Architecture Builders
==============================
Lightweight Keras Sequential builders for SimpleRNN, LSTM, GRU time-series forecasting
using a univariate (or multivariate) input with sliding window sequences.

"""
import numpy as np
import pandas as pd

from tensorflow.keras import layers, models, optimizers
# Statsmodels import here to avoid heavy import if not used
import statsmodels.api as sm


def create_sequences(X, y, lookback=24):
    # build supervised sequences for LSTM: lookback timesteps
    Xs, ys = [], []
    for i in range(lookback, len(X)):
        Xs.append(X[i-lookback:i])
        ys.append(y[i])
    return np.array(Xs), np.array(ys)


def time_train_test_split(df, test_days, freq="15T"):
    # split by last test_days
    # compute periods in a day
    periods_per_day = int(pd.Timedelta("1D") / pd.Timedelta(freq))
    test_periods = test_days * periods_per_day
    train = df.iloc[:-test_periods]
    test = df.iloc[-test_periods:]
    return train, test


def train_sarimax(train_series, exog_train, config):
    order = config.get("order", [1,0,1])
    seasonal_order = config.get("seasonal_order", [1,0,1,96])
    model = sm.tsa.statespace.SARIMAX(train_series,
                                      order=tuple(order),
                                      seasonal_order=tuple(seasonal_order),
                                      enforce_stationarity=config.get("enforce_stationarity", False),
                                      enforce_invertibility=config.get("enforce_invertibility", False))
    res = model.fit(disp=False)
    return res


def create_lstm_model(input_shape, units=64, lr=0.001):
    model = models.Sequential([
        layers.Input(shape=input_shape),
        layers.LSTM(units, activation="tanh"),
        layers.Dense(1)
    ])
    model.compile(optimizer=optimizers.Adam(learning_rate=lr), loss="mse")
    return model
