# src/data/data_load.py
import os
import glob
import logging
import pandas as pd
import yaml
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("data_load")

def load_config():
    with open("configs/params.yaml", "r") as f:
        return yaml.safe_load(f)

def read_and_concat(raw_dir, date_col, time_col, consumption_col, dayfirst=True):
    files = sorted(glob.glob(os.path.join(raw_dir, "*.csv")))
    if not files:
        raise FileNotFoundError(f"No CSV files found in {raw_dir}")
    dfs = []
    for f in files:
        logger.info(f"Loading {f}")
        df = pd.read_csv(f)
        # if files already have combined datetime, try detect
        if date_col in df.columns and time_col in df.columns:
            df["datetime"] = pd.to_datetime(df[date_col].astype(str) + " " + df[time_col].astype(str),
                                            dayfirst=dayfirst, errors="coerce")
            df = df.drop(columns=[date_col, time_col])
        elif "datetime" in df.columns:
            df["datetime"] = pd.to_datetime(df["datetime"], dayfirst=dayfirst, errors="coerce")
        else:
            raise ValueError("No datetime columns found in file: " + f)
        # ensure consumption col exists
        if consumption_col not in df.columns:
            raise ValueError(f"{consumption_col} not found in {f}")
        df = df[["datetime", consumption_col]].rename(columns={consumption_col: "consumption"})
        dfs.append(df)
    combined = pd.concat(dfs, ignore_index=True)
    combined = combined.dropna(subset=["datetime"]).sort_values("datetime").reset_index(drop=True)
    return combined

def resample_and_clean(df, freq, fillna_method, threshold_on):
    df = df.set_index("datetime")
    # resample with mean (for a timeslot)
    res = df.resample(freq).mean()
    if fillna_method == "zero":
        res["consumption"] = res["consumption"].fillna(0.0)
    elif fillna_method == "ffill":
        res["consumption"] = res["consumption"].ffill().fillna(0.0)
    # cap negative values
    res["consumption"] = res["consumption"].apply(lambda x: max(0.0, x))
    # binary ON/OFF
    res["is_on"] = (res["consumption"] >= threshold_on).astype(int)
    return res

def main():
    cfg = load_config()
    p = cfg["paths"]
    d = cfg["data"]
    raw_dir = p["raw_dir"]
    out_dir = p["processed_dir"]
    os.makedirs(out_dir, exist_ok=True)
    df = read_and_concat(raw_dir,
                         date_col=d["datetime_cols"]["date_col"],
                         time_col=d["datetime_cols"]["time_col"],
                         consumption_col=d["consumption_col"],
                         dayfirst=d.get("dayfirst", True))
    res = resample_and_clean(df, d["resample_freq"], d["fillna_method"], d["threshold_on"])
    out_file = os.path.join(out_dir, "clean_data.csv")
    res.to_csv(out_file, index=True)
    logger.info(f"Saved cleaned data to {out_file}")

if __name__ == "__main__":
    main()