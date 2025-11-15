"""
Module metrics
--------------
Implémente des métriques courantes pour les séries temporelles.
"""

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error


def metrics(y_true, y_pred):
    y_true = np.array(y_true).ravel()
    y_pred = np.array(y_pred).ravel()
    # sklearn.mean_squared_error in some installed versions doesn't accept
    # the `squared` keyword. Compute RMSE via sqrt of MSE for compatibility.
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    mape = np.mean(np.abs((y_true - y_pred) / np.clip(y_true, 1e-8, None))) * 100.0
    return {"rmse": float(rmse), "mae": float(mae), "mape": float(mape)}
