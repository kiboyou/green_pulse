# src/train_model.py
"""Training entrypoint for models.

This file may be executed directly (python src/models/train_model.py) or as a module
(python -m src.models.train_model). When executed directly, Python does not automatically
expose the `src` package on sys.path, which previously caused `ModuleNotFoundError: No module named 'models'`.

To support direct execution, add the repository `src` directory to sys.path early.
"""
import sys
from pathlib import Path

# Ensure the project's `src` directory is on sys.path so imports like `models.architecture`
# resolve when running this file directly from the repository root.
SRC_DIR = Path(__file__).resolve().parents[1]
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import json
import logging
import os

import joblib
import lightgbm as lgb
import mlflow
import numpy as np
import pandas as pd
import tensorflow as tf
import yaml
from tensorflow.keras import callbacks

from models.architecture import (create_lstm_model, create_sequences,
                                 time_train_test_split, train_sarimax)
from utils.metrics import metrics
from utils.mlflow_utils import init_mlflow, with_run_tags

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("train_model")


def load_configs():
    with open("configs/params.yaml") as f:
        cfg = yaml.safe_load(f)
    with open("configs/experiments.yaml") as f:
        exp = yaml.safe_load(f)
    return cfg, exp



def run():
    cfg, exp = load_configs()
    
    # Fast test mode: skip heavy models to keep tests quick
    if os.getenv("FAST_TEST", "0") in {"1", "true", "True"}:
        exp = {
            "models": {
                "persistence": {"enabled": True},
                "sarimax": {"enabled": False},
                "lightgbm": {"enabled": False, "params": {}},
                "lstm": {"enabled": False, "params": {}},
            }
        }
        
    p = cfg["paths"]
    features_file = p["features_file"]
    os.makedirs(p["models_dir"], exist_ok=True)
    # Initialize MLflow with professional experiment-level tags
    init_mlflow(cfg)

    df = pd.read_csv(features_file, index_col=0, parse_dates=True)
    target_col = cfg["training"]["target_col"]
    freq = cfg["data"]["resample_freq"]

    # split
    test_days = cfg["training"].get("test_size_days", 30)
    train_df, test_df = time_train_test_split(df, test_days=test_days, freq=freq)
    X_train = train_df.drop(columns=[target_col])
    y_train = train_df[target_col]
    X_test = test_df.drop(columns=[target_col])
    y_test = test_df[target_col]

    results = {}

    # PERSISTENCE baseline
    if exp["models"].get("persistence", {}).get("enabled", True):
        with mlflow.start_run(run_name="persistence"):
            mlflow.set_tags(with_run_tags(cfg, {"model": "persistence", "description": "Naive previous-value baseline"}))
            preds = y_test.shift(1).fillna(method="bfill")  # naive
            mm = metrics(y_test, preds)
            mlflow.log_metrics(mm)
            results["persistence"] = mm
            logger.info("Persistence metrics: %s", mm)

    # SARIMAX
    if exp["models"].get("sarimax", {}).get("enabled", True):
        sar_conf = exp["models"]["sarimax"]
        with mlflow.start_run(run_name="sarimax"):
            mlflow.set_tags(with_run_tags(cfg, {
                "model": "sarimax",
                "description": "Seasonal ARIMA with exogenous (if any)",
                "order": sar_conf.get("order"),
                "seasonal_order": sar_conf.get("seasonal_order"),
            }))
            try:
                res = train_sarimax(y_train, None, sar_conf)
                steps = len(y_test)
                pred = res.get_forecast(steps=steps).predicted_mean
                mm = metrics(y_test, pred)
                mlflow.log_params({"order": sar_conf.get("order"), "seasonal_order": sar_conf.get("seasonal_order")})
                mlflow.log_metrics(mm)
                # save model via joblib (statsmodels objects serializable)
                model_path = os.path.join(p["models_dir"], "sarimax.pkl")
                joblib.dump(res, model_path)
                mlflow.log_artifact(model_path, artifact_path="models")
                results["sarimax"] = mm
                logger.info("SARIMAX metrics: %s", mm)
            except Exception as e:
                logger.error("SARIMAX failed: %s", e)

    # LightGBM
    if exp["models"].get("lightgbm", {}).get("enabled", True):
        lgb_conf = exp["models"]["lightgbm"]["params"]
        # choose first combination for simplicity here; for real HPO iterate grid
        param = {k: v[0] if isinstance(v, list) else v for k, v in exp["models"]["lightgbm"]["params"].items()}
        with mlflow.start_run(run_name="lightgbm"):
            mlflow.set_tags(with_run_tags(cfg, {"model": "lightgbm", "description": "Gradient boosting regressor on lag/time features"}))
            dtrain = lgb.Dataset(X_train, label=y_train)
            model = lgb.train(param, dtrain, num_boost_round=param.get("n_estimators", 100))
            pred = model.predict(X_test)
            mm = metrics(y_test, pred)
            mlflow.log_params(param)
            mlflow.log_metrics(mm)
            model_path = os.path.join(p["models_dir"], "lightgbm.txt")
            model.save_model(model_path)
            mlflow.log_artifact(model_path, artifact_path="models")
            results["lightgbm"] = mm
            logger.info("LightGBM metrics: %s", mm)

    # LSTM (using scaled features; sequences)
    if exp["models"].get("lstm", {}).get("enabled", True):
        lstm_conf = exp["models"]["lstm"]["params"]
        # use first params
        params = {k: v[0] if isinstance(v, list) else v for k, v in lstm_conf.items()}
        lookback = 96  # e.g., use last day as context; tweak in config
        # prepare numpy arrays
        Xt = X_train.values
        yt = y_train.values
        Xs_train, ys_train = create_sequences(Xt, yt, lookback=lookback)
        Xtst = X_test.values
        ys = y_test.values
        # for test, create sequences from combined tail of train+test to ensure continuity
        combined = np.vstack([Xt, Xtst])
        combined_y = np.concatenate([yt, ys])
        Xs_all, ys_all = create_sequences(combined, combined_y, lookback=lookback)
        # split last len(test) sequences as test
        n_test = len(ys)
        Xs_test = Xs_all[-n_test:]
        ys_test = ys_all[-n_test:]
        Xs_train2 = Xs_all[:-n_test]
        ys_train2 = ys_all[:-n_test]

        tf.keras.backend.clear_session()
        model = create_lstm_model(input_shape=(Xs_train2.shape[1], Xs_train2.shape[2]),
                                  units=int(params.get("units", 64)),
                                  lr=float(params.get("lr", 0.001)))
        es = callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)
        with mlflow.start_run(run_name="lstm"):
            mlflow.set_tags(with_run_tags(cfg, {"model": "lstm", "description": "Univariate LSTM on sliding windows"}))
            history = model.fit(Xs_train2, ys_train2, validation_split=0.1,
                                epochs=int(params.get("epochs", 20)),
                                batch_size=int(params.get("batch_size", 64)),
                                callbacks=[es], verbose=0)
            pred = model.predict(Xs_test).ravel()
            mm = metrics(ys_test, pred)
            mlflow.log_params(params)
            mlflow.log_metrics(mm)
            # save model
            model_path = os.path.join(p["models_dir"], "lstm_model.h5")
            model.save(model_path)
            mlflow.log_artifact(model_path, artifact_path="models")
            results["lstm"] = mm
            logger.info("LSTM metrics: %s", mm)

    # Save summary
    report_path = os.path.join(cfg["paths"]["reports_dir"], "metrics_summary.json")
    os.makedirs(cfg["paths"]["reports_dir"], exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)
    logger.info(f"Saved summary metrics to {report_path}")

if __name__ == "__main__":
    run()