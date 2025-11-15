import os

import pandas as pd
import yaml


def test_features_file_exists_and_has_target():
	with open("configs/params.yaml") as f:
		cfg = yaml.safe_load(f)
	features_path = cfg["paths"]["features_file"]
	assert os.path.exists(features_path), f"features file missing: {features_path}"
	df = pd.read_csv(features_path, index_col=0, parse_dates=True)
	target_col = cfg["training"]["target_col"]
	assert target_col in df.columns, f"Target column '{target_col}' not found in features file"
	assert len(df) > 0, "Features dataframe empty"