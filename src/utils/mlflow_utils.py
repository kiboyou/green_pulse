"""MLflow Utilities
===================
Professional initialization and tagging helpers for ML experiments.

Functions
---------
- init_mlflow(cfg: dict) -> None
  Sets tracking URI, creates/sets experiment, and applies consistent experiment-level tags.
- with_run_tags(tags: dict) -> dict
  Merge default run-level tags (git info, data fingerprint, target variable, etc.) with custom tags.
- data_fingerprint(df) -> str
  Stable hash summarizing input data used for training/eval.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
from typing import Any, Dict

import mlflow


def _git(cmd: list[str]) -> str:
    try:
        out = subprocess.check_output(["git", *cmd], stderr=subprocess.DEVNULL).decode().strip()
        return out
    except Exception:
        return ""


def _hash_obj(obj: Any) -> str:
    s = json.dumps(obj, sort_keys=True, default=str).encode()
    return hashlib.sha256(s).hexdigest()[:16]


def init_mlflow(cfg: Dict[str, Any]) -> None:
    """Initialize MLflow according to config and set experiment-level tags & description.

    Expected cfg keys:
      - mlflow.tracking_uri
      - mlflow.experiment_name
      - mlflow.experiment_description (optionnel)
      - training.target_col
    """
    tracking_uri = cfg.get("mlflow", {}).get("tracking_uri", "file:./mlruns")
    exp_name = cfg.get("mlflow", {}).get("experiment_name", "default")
    target = cfg.get("training", {}).get("target_col", "target")
    exp_desc = cfg.get("mlflow", {}).get(
        "experiment_description",
        "GreenPulse energy demand forecasting experiments"
    )

    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(exp_name)

    # Set experiment tags (applies to current active experiment)
    client = mlflow.tracking.MlflowClient()
    exp = client.get_experiment_by_name(exp_name)
    if exp is not None:
        client.set_experiment_tag(exp.experiment_id, "project", "GreenPulse")
        client.set_experiment_tag(exp.experiment_id, "target", target)
        client.set_experiment_tag(exp.experiment_id, "environment", os.getenv("ENV", "dev"))
        # Description visible dans l'UI MLflow via un tag standard
        client.set_experiment_tag(exp.experiment_id, "description", exp_desc)
        client.set_experiment_tag(exp.experiment_id, "mlflow.note.content", exp_desc)


def with_run_tags(cfg: Dict[str, Any], extra: Dict[str, Any] | None = None) -> Dict[str, str]:
    """Compose consistent MLflow run tags with repo and dataset context.

    Default tags include:
      - git.commit, git.branch
      - target
      - config.hash
      - run.env
    """
    commit = _git(["rev-parse", "HEAD"]) or os.getenv("GIT_COMMIT", "")
    branch = _git(["rev-parse", "--abbrev-ref", "HEAD"]) or os.getenv("GIT_BRANCH", "")
    conf_hash = _hash_obj(cfg)
    tags: Dict[str, str] = {
        "git.commit": commit,
        "git.branch": branch,
        "target": cfg.get("training", {}).get("target_col", "target"),
        "config.hash": conf_hash,
        "run.env": os.getenv("ENV", "dev"),
        "run.author": os.getenv("USER", "unknown"),
    }
    if extra:
        # Flatten values to strings for tag compatibility
        for k, v in extra.items():
            tags[k] = str(v)
        # Map 'description' vers la note MLflow pour meilleure visibilité
        if "description" in extra:
            tags["mlflow.note.content"] = str(extra["description"])
    return tags
