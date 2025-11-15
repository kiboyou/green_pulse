# src/data/feature_engineering.py
import os
import logging
import pandas as pd
import numpy as np
import joblib
import yaml
from sklearn.preprocessing import StandardScaler, MinMaxScaler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("feature_engineering")

def load_config():
    with open("configs/params.yaml", "r") as f:
        return yaml.safe_load(f)

def create_time_features(df):
    df = df.copy()
    df["hour"] = df.index.hour
    df["dayofweek"] = df.index.dayofweek
    df["day"] = df.index.day
    df["month"] = df.index.month
    df["weekofyear"] = df.index.isocalendar().week.astype(int)
    return df

def create_lags_rolls(df, lags=[1,2,3,4,96], windows=[4,8,96]):
    df = df.copy()
    for lag in lags:
        df[f"lag_{lag}"] = df["consumption"].shift(lag)
    for w in windows:
        df[f"roll_mean_{w}"] = df["consumption"].rolling(window=w, min_periods=1).mean().shift(1)
    return df

def scale_features(X, method="standard", save_path=None):
    if method == "none":
        return X, None
    if method == "standard":
        scaler = StandardScaler()
    else:
        scaler = MinMaxScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X), index=X.index, columns=X.columns)
    if save_path:
        joblib.dump(scaler, save_path)
    return X_scaled, scaler

def main():
    cfg = load_config()
    p = cfg["paths"]
    data_file = p["processed_dir"] + "/clean_data.csv"
    out_features = p["features_file"]
    scaler_path = os.path.join(p["artifacts_dir"], "scaler.joblib")
    os.makedirs(os.path.dirname(out_features), exist_ok=True)
    os.makedirs(p["artifacts_dir"], exist_ok=True)

    df = pd.read_csv(data_file, index_col=0, parse_dates=True)
    df.index.name = "datetime"

    df = create_time_features(df)
    df = create_lags_rolls(df, lags=[1,2,3,4,96], windows=[4,8,96])

    # drop na after lagging
    df = df.dropna()

    target_col = cfg["training"]["target_col"]
    X = df.drop(columns=[target_col])
    y = df[[target_col]]

    X_scaled, scaler = scale_features(X, method=cfg["training"].get("scale_method", "standard"),
                                     save_path=scaler_path)
    if scaler is not None:
        logger.info(f"Scaler saved to {scaler_path}")
    # Save combined features
    features = pd.concat([X_scaled.reset_index(drop=False).set_index("datetime"), y.reset_index(drop=False).set_index("datetime")], axis=1)
    features.to_csv(out_features)
    logger.info(f"Saved features to {out_features}")

if __name__ == "__main__":
    main()