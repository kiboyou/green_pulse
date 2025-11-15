# Green Pulse — Model Comparison

This document summarizes how we compare forecasting models for energy time series and how to reproduce results.

## Scope

- Target: univariate energy consumption/production series (`timestamp`, `value`).
- Horizon: configurable (default 24 steps).
- Frequency: resampled to a fixed interval (default `H`), configurable in `configs/experiments.yaml`.
- Features: lagged values up to `n_lags` (default 24).

## Models Compared

- Ridge Regression
- Lasso Regression
- Random Forest Regressor
- Gradient Boosting Regressor

All models are trained on lag features and evaluated with a rolling one-step-ahead strategy to produce a multi-step forecast for the validation horizon.

## Metrics

- RMSE (primary for selection)
- MAE (secondary)

Both are logged to MLflow for each run.

## How to Run Experiments

1. Configure experiments in `configs/experiments.yaml`:
   - `experiment.name`, `tracking_uri`, `horizon`, `freq`, `n_lags`
   - `algorithms.<name>.params` define parameter grids for grid search
2. Ensure processed data exists at `data/processed/dataset.txt` or the CSV referenced by `src/utils/config.py` (`PROCESSED_FILE`). The pipeline expects columns `timestamp` and `value`.
3. Run the experiment entrypoint:

   - Python API:
     ```python
     from src.experiments.experiment_runner import run_experiments
     scores = run_experiments()
     print(scores)
     ```
   - CLI (optional): you can also create a simple CLI wrapper if desired. Currently, invoking `run_experiments()` from a Python session is sufficient.

4. Inspect MLflow UI at the configured tracking URI to compare runs.

## Selection and Promotion

- The runner performs a grid search across the provided parameter grids.
- For each model family, the best RMSE is tracked.
- The overall best run (lowest validation RMSE) is saved under `models/<model>_<idx>_energy_forecast.joblib` and also promoted to the canonical path `models/energy_forecast.joblib`.

## Reproducibility

- All hyperparameters and key settings (n_lags, freq) are logged as parameters in MLflow.
- Artifacts: the trained model object and metadata are saved with joblib and logged to MLflow.
- Data versioning (optional): You can integrate DVC to version datasets and add a `dvc.yaml` pipeline if needed.

## Recommended Next Steps

- Add cross-validation over rolling windows for more robust estimates.
- Extend model zoo (XGBoost/LightGBM/CatBoost, Prophet, SARIMAX, simple LSTM/Temporal CNN if GPU not required).
- Add confidence intervals via residual bootstrapping.
- Enable randomized search for large grids (`n_iter`) and early stopping where available.
- Log forecast curves as plots in MLflow for visual inspection.
