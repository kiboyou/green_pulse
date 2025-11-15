import pandas as pd
import yaml

from src.data.feature_engineering import (create_lags_rolls,
                                          create_time_features)


def test_create_features_shapes():
	with open("configs/params.yaml") as f:
		cfg = yaml.safe_load(f)
	clean_path = cfg["paths"]["processed_dir"] + "/clean_data.csv"
	df = pd.read_csv(clean_path, index_col=0, parse_dates=True)
	df = df.head(300)  # keep it light
	df2 = create_time_features(df)
	assert {"hour", "dayofweek", "month"}.issubset(df2.columns)
	df3 = create_lags_rolls(df2)
	# After lags, expect lag_1 column and some NaNs at the top; dropping NaNs should leave rows
	assert "lag_1" in df3.columns
	assert df3.dropna().shape[0] > 0