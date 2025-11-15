<div align="center">

# Green Pulse ⚡️ — Prévision de la consommation énergétique

_Projet MLOps (régression sur séries temporelles) : ingestion, feature engineering, entraînement multi‑modèles, suivi d'expériences, API d'inférence, frontend & pipeline reproductible._

</div>

## 1. Objectifs

Prévoir la demande énergétique à partir d'une série temporelle de consommation (granularité 15 minutes). Le projet vise :

- Des modèles comparatifs (Persistence, SARIMAX, LightGBM, LSTM)
- Une pipeline de données/versioning (DVC)
- Un suivi d'expériences (MLflow) avec tags professionnels
- Une API d'inférence (FastAPI) + un frontend (Next.js) pour la visualisation
- Des tests automatisés (Pytest) assurant la stabilité des composants

## 2. Structure réelle du dépôt

```
├── configs/               # YAML de configuration (params, expériences)
├── data/                  # Données brutes & transformées (versionnées par DVC)
├── dvc.yaml               # Définition des stages pipeline
├── docker/                # Dockerfiles & docker-compose
├── frontend/              # UI Next.js (pages prediction & performance)
├── mlruns/                # Backend MLflow local (tracking_uri file:./mlruns)
├── notebooks/             # Exploration & prototypage
├── reports/               # Sorties (metrics_summary.json / .csv)
├── src/
│   ├── api/serve_api.py   # Application FastAPI (endpoints inference & metadata)
│   ├── data/data_load.py  # Chargement & nettoyage initial
│   ├── data/feature_engineering.py  # Lags & features temporelles
│   ├── models/architecture.py       # Construction des modèles (LSTM, SARIMAX utils)
│   ├── models/train_model.py        # Script d'entraînement multi‑modèles
│   ├── utils/metrics.py             # Calcul métriques rmse/mae/mape
│   ├── utils/mlflow_utils.py        # Initialisation & tags MLflow
│   └── utils/evaluate_model.py      # Post‑évaluation & export CSV
├── tests/                # Tests Pytest (data, features, API, smoke train)
├── requirements.txt      # Dépendances Python
└── README.md             # Ce document
```


## 3. Pipeline DVC

`dvc.yaml` définit 4 stages :

| Stage       | Commande                              | Entrées                                | Sorties                                 |
|-------------|----------------------------------------|----------------------------------------|------------------------------------------|
| load_data   | `python src/data/data_load.py`         | params.yaml, script data_load          | `data/processed/clean_data.csv`          |
| features    | `python src/data/feature_engineering.py` | clean_data.csv, params.yaml          | `data/processed/features.csv`            |
| train       | `python src/models/train_model.py`     | features.csv, params.yaml, experiments | `models/`, `reports/metrics_summary.json`|
| evaluate    | `python src/utils/evaluate_model.py`   | metrics_summary.json                   | `reports/metrics_summary.csv`            |

Reproduction complète :

```bash
dvc repro          # exécute toute la pipeline
dvc status         # état des outputs vs deps
```

## 4. Quickstart (Local)

```bash
# 1. Environnement Python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Récupération des données (si remote configuré)
dvc pull

# 3. Entraînement (complet)
python -m src.models.train_model

# 4. Mode rapide (tests / debug)
FAST_TEST=1 python -m src.models.train_model

# 5. Lancement API
uvicorn src.api.serve_api:app --reload --port 8000

# 6. MLflow UI
mlflow ui --backend-store-uri file:./mlruns --port 5000

# 7. Frontend (dans ./frontend)
cd frontend && npm install && npm run dev
```

## 5. Modélisation

| Modèle      | Description                                 | Points clés |
|-------------|----------------------------------------------|-------------|
| Persistence | Baseline copie dernière valeur               | Aucun param |
| SARIMAX     | Saisonnière (ordre issu de config)           | `order`, `seasonal_order` |
| LightGBM    | Gradient boosting sur features temporelles   | `n_estimators`, `learning_rate`, lags |
| LSTM        | Séquences glissantes univariées              | `units`, `epochs`, `batch_size`, `lr` |

La logique LSTM prépare des fenêtres de taille lookback (par défaut 96 = journée complète en 15T) et applique EarlyStopping.

## 6. Métriques

Calculées via `utils/metrics.py` : `rmse`, `mae`, `mape` (RMSE calculé comme √MSE pour compatibilité). Résumé global sauvegardé dans `reports/metrics_summary.json` et exposé par l'endpoint `/metrics/summary`.

## 7. Suivi des expériences (MLflow)

- Initialisation via `init_mlflow(cfg)` (tracking URI + tags d'expérience).
- Tags standard par run via `with_run_tags(cfg, extra)` :
  - `git.commit`, `git.branch`
  - `target`, `config.hash`
  - `run.env`, `run.author`
  - + tags spécifiques (`model`, `description`, hyperparamètres)
- Artefacts : modèles (`lightgbm.txt`, `sarimax.pkl`, `lstm_model.h5`), `metrics_summary.json`.

Variables d'environnement utiles :
```text
ENV=dev|staging|prod   # influe sur les tags
FAST_TEST=1            # raccourcit l'entraînement (désactive modèles lourds)
GIT_COMMIT / GIT_BRANCH # override si git non disponible
```

## 8. API (FastAPI)

Fichier : `src/api/serve_api.py`

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/health` | GET | Liveness & horodatage |
| `/models` | GET | Liste des fichiers présents dans `models/` |
| `/metrics/summary` | GET | Contenu JSON des métriques agrégées |
| `/predict` | POST | Prédiction 1 pas (payload récent + modèle choisi) |
| `/forecast` | POST (upload fichier) | Naive forecast + métriques baselines |

Exemple `predict` :
```json
{
  "recent_history": [10.2, 11.4, 11.8, 12.0],
  "model": "lightgbm"
}
```

Lancer localement :
```bash
uvicorn src.api.serve_api:app --reload --port 8000
```

## 9. Frontend (Next.js)

Pages principales :
- `prediction` : upload série (`/forecast`) et visualisation des points futurs
- `performance` : comparaison métriques via `/metrics/summary`

Variable exposée : `NEXT_PUBLIC_API_URL` (config du host API).

## 10. Tests (Pytest)

Local :
```bash
pytest -q
```

Couverture actuelle :
- Chargement & présence des features (`test_data_load.py`)
- Feature engineering (lags/features) (`test_feature_engineering.py`)
- API endpoints santé / modèles / forecast (`test_api.py`)
- Entraînement rapide smoke (`test_train_smoke.py`)

## 11. Configuration

Deux fichiers YAML :
- `configs/params.yaml` : chemins, fréquence, colonnes, MLflow.
- `configs/experiments.yaml` : activation modèles + grilles hyperparamètres.

Hash de configuration (`config.hash`) généré pour traçabilité dans MLflow.

## 12. Docker

Build & run (API + frontend) :
```bash
docker compose -f docker/docker-compose.yml up --build
```

## 13. Roadmap technique (extraits)

- [ ] Validation temporelle glissante formelle (backtesting)
- [ ] Logging structuré JSON + collecteur (ELK)
- [ ] Callback MLflow pour epoch LSTM (loss curve)
- [ ] Monitoring drift (intégration Evidently / Prometheus)
- [ ] Export modèle vers ONNX / TF SavedModel
- [ ] Workflows GitHub Actions CI/CD (`.github/workflows/`)
- [ ] Mode multi-séries / features exogènes (température, météo, prix)

## 14. Contribution

```bash
git checkout -b feature/ma-fonction
# coder + tests
pytest -q
git commit -m "feat: nouvelle fonctionnalité"
git push origin feature/ma-fonction
```
Ouvrez ensuite une Pull Request.

## 15. Licence / Droits

Si nécessaire, ajouter une section licence (MIT / Apache 2.0). Actuellement : usage académique interne.

## 16. Références & Ressources

- MLflow docs : https://mlflow.org
- LightGBM : https://lightgbm.readthedocs.io
- Statsmodels SARIMAX : https://www.statsmodels.org
- FastAPI : https://fastapi.tiangolo.com
- DVC : https://dvc.org

---