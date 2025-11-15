import io
import json
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

# Ensure project root on path
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

try:
    from api.serve_api import app  # src inserted into path above
except ModuleNotFoundError:
    # Fallback: attempt relative import with explicit package creation
    import importlib.util
    spec = importlib.util.spec_from_file_location("serve_api", SRC / "api" / "serve_api.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    app = getattr(mod, "app")

client = TestClient(app)


def test_health():
    r = client.get('/health')
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'ok'
    assert 'time' in data


def test_models_list():
    r = client.get('/models')
    assert r.status_code == 200
    assert 'models' in r.json()


def test_predict_persistence():
    payload = {"recent_history": [1,2,3,4], "model": "persistence"}
    r = client.post('/predict', json=payload)
    assert r.status_code == 200
    data = r.json()
    assert 'predictions' in data and len(data['predictions']) == 1


def test_forecast_upload_csv():
    csv_content = 'timestamp,value\n2025-10-27T00:00:00Z,10\n2025-10-27T01:00:00Z,12\n2025-10-27T02:00:00Z,11\n'
    files = {"file": ("sample.csv", csv_content, "text/csv")}
    r = client.post('/forecast', files=files)
    assert r.status_code == 200, r.text
    data = r.json()
    assert 'forecast' in data and len(data['forecast']) == 3
    assert 'metrics' in data and 'mae' in data['metrics']
