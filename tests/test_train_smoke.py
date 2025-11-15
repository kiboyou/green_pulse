import json
import os

import yaml

from src.models.train_model import run


def test_train_smoke_persistence_only(tmp_path, monkeypatch):
	# Ensure fast test mode
	monkeypatch.setenv("FAST_TEST", "1")
	# Run training
	run()
	with open("configs/params.yaml") as f:
		cfg = yaml.safe_load(f)
	report_path = os.path.join(cfg["paths"]["reports_dir"], "metrics_summary.json")
	assert os.path.exists(report_path), "metrics_summary.json not created"
	with open(report_path) as f:
		data = json.load(f)
	assert "persistence" in data, "persistence metrics missing"
	assert len(data["persistence"]) > 0, "persistence metrics empty"