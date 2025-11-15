# src/evaluate_model.py
import json
import logging
import os

import matplotlib.pyplot as plt
import pandas as pd
import yaml

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("evaluate_model")

def load_configs():
    with open("configs/params.yaml") as f:
        cfg = yaml.safe_load(f)
    return cfg

def main():
    cfg = load_configs()
    rep = cfg["paths"]["reports_dir"]
    os.makedirs(rep, exist_ok=True)
    summary_file = os.path.join(rep, "metrics_summary.json")
    if not os.path.exists(summary_file):
        logger.error("Metrics summary not found. Run training first.")
        return
    with open(summary_file) as f:
        metrics = json.load(f)
    # Print summary
    print("Model comparison:")
    for m, s in metrics.items():
        print(f"- {m}: {s}")
    # save a simple CSV
    df = pd.DataFrame(metrics).T
    df.to_csv(os.path.join(rep, "metrics_summary.csv"))
    logger.info("Saved metrics CSV")

if __name__ == "__main__":
    main()