# Projet Deep Learning - Terminale Data Science

Ce dépôt propose une architecture technique recommandée pour un projet de Deep Learning.

## Structure principale

- src/
  - data/
    - __init__.py
    - dataset.py
    - preprocessing.py
  - models/
    - __init__.py
    - architecture.py
    - training.py
  - api/
    - __init__.py
    - main.py
    - endpoints.py
  - utils/
    - __init__.py
    - config.py
    - metrics.py
- frontend/ (optionnel)
  - src/
  - public/
  - package.json
  - README.md
# Green Pulse — Forecast de demande énergétique

Projet MLOps (Catégorie 2 : Régression) visant à prévoir la demande énergétique à partir de séries temporelles.

Ce dépôt contient la stack du projet : ingestion / preprocessing, entraînement, suivi d'expérimentations, API d'inférence, frontend et artefacts (DVC / MLflow / Docker / CI).

## Vue d'ensemble du dépôt

- `src/` : code principal (data, preprocessing, modèles, API, expérimentations)
- `frontend/` : interface Next.js (UI)
- `notebooks/` : exploration et expérience réplicable
- `tests/` : tests unitaires et d'intégration
- `docker/` : Dockerfile pour l'API et le frontend, et `docker-compose.yml`
- `mlruns/` : répertoire local pour le suivi MLflow (par défaut)
- `requirements.txt` : dépendances Python
- `data/` : jeux de données brut et transformés (versionnés avec DVC)

## Objectifs et livrables (7 semaines)

Basé sur le cahier des charges, le projet se déroule ainsi :

- Semaine 1 — Exploration (focus temporel)
  - EDA : tendances, saisonnalités (journalières, hebdo, annuelles), résidus
  - Feature engineering temporel : lags, moyennes mobiles, features calendaires
  - Versioning données : mise en place DVC pour les jeux de données et features

- Semaine 2 — Modélisation (baseline)
  - Baseline simple + modèles Prophet / ARIMA
  - Tracking avec MLflow (RMSE, MAE, MAPE)
  - Validation temporelle : sliding window / rolling CV

- Semaine 3 — Pipeline de formation
  - Script pipeline reproductible (chargement DVC, preprocessing, entraînement)
  - Containerisation du pipeline (Dockerfile)
  - Tests unitaires pour composants ML

- Semaine 4 — Pipeline d'inférence & API
  - API FastAPI (POST /predict)
  - Image Docker dédiée pour l'API
  - Tests d'intégration

- Semaine 5 — Déploiement & CI/CD
  - Workflows GitHub Actions : CI (tests) et CD (déploiement sur tag)
  - Gestion des configs dev/staging/prod

- Semaine 6 — Monitoring
  - Logging structuré des prédictions
  - Dashboard (Grafana) pour data drift et concept drift
  - Alertes automatiques

- Semaine 7 — Finalisation & démo
  - Documentation complète (architecture, API, how-to)
  - Tests de charge
  - Préparation d'une démo end-to-end (~10 min)

## Quickstart local

Prérequis : Python 3.10+ (ou l'environnement virtuel fourni dans `env/`), Node.js pour le frontend, Docker si vous voulez containeriser.

1) Créer et activer un environnement Python puis installer les dépendances :

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2) Récupérer les données versionnées (si DVC est utilisé pour stocker les artefacts externes) :

```bash
# si DVC est configuré :
dvc pull
```

3) Lancer le pipeline d'entraînement (exemple) :

```bash
# Exemple : exécuter le runner d'expérimentations (adapté au projet)
python -m src.experiments.experiment_runner
```

4) Consulter les runs MLflow :

```bash
mlflow ui --port 5000
# puis ouvrir http://localhost:5000
```

5) Lancer l'API FastAPI en local :

```bash
uvicorn src.api.main:app --reload --port 8000
```

6) Lancer le frontend (séparé dans `frontend/`) : voir `frontend/README.md`.

## Docker / Compose

Pour démarrer les containers (API + frontend selon `docker/docker-compose.yml`) :

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Tests

Lancer la suite de tests Python :

```bash
pytest -q
```

## Bonnes pratiques et outils utilisés

- Data versioning : DVC
- Experiment tracking : MLflow
- API : FastAPI (POST /predict attendu)
- Containerisation : Docker
- CI/CD : GitHub Actions (workflows CI pour tests, CD pour release/tag)
- Monitoring : Prometheus + Grafana (pour drift & alerting)

## Contribution

1. Forkez le dépôt
2. Créez une branche feature : `git checkout -b feature/ma-fonction`
3. Rédigez des tests et validez localement
4. Ouvrez une Pull Request

## Ressources & prochains pas

- Compléter la mise en place DVC (remote storage) si nécessaire
- Ajouter workflows GitHub Actions dans `.github/workflows/`
- Rédiger documentation d'architecture et guide de déploiement (docs/)

---
Fin du README principal. Pour les détails frontend, voir `frontend/README.md`.