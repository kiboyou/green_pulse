"""FastAPI application exposing forecasting and model meta endpoints.

Endpoints:
  GET /health            -> simple liveness
  GET /models            -> list available model artifact files
  GET /metrics/summary   -> return metrics_summary.json if present
  POST /predict          -> one-step prediction given recent history
  POST /forecast         -> upload CSV/JSON time series and return naive forecast + demo metadata

The frontend currently expects /forecast for file uploads returning a rich JSON
object with keys: label, confidence, topK, forecast[], model, inference_ms, timestamp, metrics.
"""
from __future__ import annotations

import io
import json
import os
import time
from datetime import datetime, timedelta, timezone

import joblib
import numpy as np
import pandas as pd
import uvicorn
import yaml
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from tensorflow.keras.models import load_model
from pydantic import BaseModel, Field

app = FastAPI(title="Green Pulse - Energy Forecast API", version="0.2.0")

# CORS for local development: allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # consider restricting in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_PATH = os.path.join("configs", "params.yaml")

def load_config():
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError(f"Config file not found at {CONFIG_PATH}")
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)

try:
    cfg = load_config()
except Exception as e:  # allow app start even if config missing (tests can mock)
    cfg = {"paths": {"models_dir": "models", "reports_dir": "reports"}}
    print(f"[WARN] Failed to load config: {e}")

models_dir = cfg["paths"].get("models_dir", "models")
reports_dir = cfg["paths"].get("reports_dir", "reports")

class PredictRequest(BaseModel):
    recent_history: list[float] = Field(..., description="Recent consumption values, most recent last")
    model: str = Field("lightgbm", description="Model identifier: lightgbm|lstm|sarimax|persistence")

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

@app.get("/models")
def list_models():
    if not os.path.isdir(models_dir):
        return {"models": []}
    files = [f for f in os.listdir(models_dir) if os.path.isfile(os.path.join(models_dir, f))]
    return {"models": files}

@app.get("/metrics/summary")
def metrics_summary():
    summary_path = os.path.join(reports_dir, "metrics_summary.json")
    if not os.path.exists(summary_path):
        raise HTTPException(status_code=404, detail="metrics_summary.json not found")
    with open(summary_path) as f:
        data = json.load(f)
    return data

@app.post("/predict")
def predict(req: PredictRequest):
    if not req.recent_history:
        raise HTTPException(status_code=400, detail="recent_history is empty")
    model_name = req.model.lower()
    recent = req.recent_history
    # persistence baseline
    if model_name == "persistence":
        return {"predictions": [float(recent[-1])], "model": "persistence"}
    # dispatch
    try:
        if model_name == "lightgbm":
            import lightgbm as lgb
            model_path = os.path.join(models_dir, "lightgbm.txt")
            if not os.path.exists(model_path):
                raise HTTPException(status_code=404, detail="LightGBM model file missing")
            model = lgb.Booster(model_file=model_path)
            lags = {f"lag_{i}": (recent[-i] if len(recent) >= i else recent[-1]) for i in [1,2,3,4,96]}
            X = pd.DataFrame([lags])
            pred = model.predict(X)[0]
            return {"predictions": [float(pred)], "model": "lightgbm"}
        if model_name == "lstm":
            model_path = os.path.join(models_dir, "lstm_model.h5")
            if not os.path.exists(model_path):
                raise HTTPException(status_code=404, detail="LSTM model file missing")
            model = load_model(model_path)
            arr = np.array(recent[-96:]).reshape((1, 96, 1))
            p = model.predict(arr).ravel().tolist()
            return {"predictions": [float(p[-1])], "sequence": p, "model": "lstm"}
        if model_name == "sarimax":
            sarimax_path = os.path.join(models_dir, "sarimax.pkl")
            if not os.path.exists(sarimax_path):
                raise HTTPException(status_code=404, detail="SARIMAX model file missing")
            res = joblib.load(sarimax_path)
            p = res.get_forecast(steps=1).predicted_mean.tolist()
            return {"predictions": p, "model": "sarimax"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference error: {e}")
    raise HTTPException(status_code=400, detail="Unsupported model")

def _parse_uploaded_series(content: bytes, filename: str) -> pd.DataFrame:
    name = (filename or "").lower()
    text = content.decode("utf-8", errors="replace")
    if name.endswith(".json") or text.strip().startswith("["):
        data = json.loads(text)
        df = pd.DataFrame(data)
    else:  # assume CSV
        df = pd.read_csv(io.StringIO(text))
    # standardize columns
    # Expect at least timestamp/value or single numeric column
    if "timestamp" in df.columns and "value" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
        df = df.dropna(subset=["timestamp"])  # drop bad timestamps
        return df[["timestamp", "value"]]
    # fallback: take first datetime-like + first numeric
    datetime_col = None
    value_col = None
    for c in df.columns:
        if datetime_col is None:
            try:
                parsed = pd.to_datetime(df[c], utc=True)
                # consider a column datetime if at least half parse
                if parsed.notna().mean() > 0.5:
                    datetime_col = c
            except Exception:
                pass
        if value_col is None and pd.api.types.is_numeric_dtype(df[c]):
            value_col = c
    if datetime_col and value_col:
        out = pd.DataFrame({"timestamp": pd.to_datetime(df[datetime_col], utc=True, errors="coerce"), "value": df[value_col]})
        out = out.dropna(subset=["timestamp"])  # ensure valid timestamp
        return out
    # last resort: generate synthetic timestamps
    if pd.api.types.is_numeric_dtype(df[df.columns[0]]):
        n = len(df)
        base = datetime.now(timezone.utc) - timedelta(minutes=n)
        ts = [base + timedelta(minutes=i) for i in range(n)]
        return pd.DataFrame({"timestamp": ts, "value": df[df.columns[0]]})
    raise ValueError("Unable to parse time series; provide timestamp,value format")

@app.post("/forecast")
async def forecast(file: UploadFile = File(...)):
    start = time.time()
    content = await file.read()
    try:
        series = _parse_uploaded_series(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if series.empty:
        raise HTTPException(status_code=400, detail="Uploaded series is empty")
    series = series.sort_values("timestamp")
    last_ts = series["timestamp"].iloc[-1]
    last_val = float(series["value"].iloc[-1])
    # naive forecast: repeat last value for next 3 periods (hourly guess)
    horizon = [last_ts + timedelta(hours=i+1) for i in range(3)]
    forecast_points = [{"timestamp": ts.isoformat(), "value": last_val} for ts in horizon]
    # compute simple metrics using naive shift
    if len(series) > 1:
        y_true = series["value"].iloc[1:].to_numpy()
        y_pred = series["value"].shift(1).iloc[1:].to_numpy()
        mae = float(np.mean(np.abs(y_true - y_pred)))
        rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    else:
        mae = rmse = 0.0
    inference_ms = int((time.time() - start) * 1000)
    resp = {
        "label": "Prévision énergétique",
        "confidence": 0.75,  # placeholder heuristic
        "topK": [
            {"label": "Pic de charge", "prob": 0.6},
            {"label": "Tendance normale", "prob": 0.3},
            {"label": "Anomalie possible", "prob": 0.1},
        ],
        "forecast": forecast_points,
        "model": "naive-persistence",
        "inference_ms": inference_ms,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": {"mae": mae, "rmse": rmse},
    }
    return resp

if __name__ == "__main__":  # pragma: no cover
    uvicorn.run(app, host="0.0.0.0", port=8000)