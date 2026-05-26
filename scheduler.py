"""
Scheduler — Collecte hebdomadaire des données + re-entraînement automatique.

Utilise APScheduler pour déclencher :
  - Chaque lundi à 03h00 : collecte des données macro via FRED/BLS (optionnel)
  - Chaque lundi à 04h00 : re-entraînement complet des modèles XGBoost
  - Chaque jour   à 06h00 : health check silencieux des modèles

Lancer en standalone :  python scheduler.py
En production, ce module peut aussi être importé et démarré avec l'API.
"""

import logging
import json
from datetime import datetime
from pathlib import Path

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

BASE_DIR  = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "ml" / "models"

logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s [%(levelname)s] %(message)s",
    datefmt= "%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


# ── Tâches planifiées ─────────────────────────────────────────────────────────

def task_retrain():
    """
    Re-entraîne les deux modèles XGBoost (quarterly + semester) et calcule les
    SHAP values. Log les métriques après chaque entraînement.
    """
    log.info("══════════════════════════════════════════")
    log.info("  TÂCHE PLANIFIÉE : Re-entraînement XGBoost")
    log.info("══════════════════════════════════════════")
    try:
        from ml.pipeline.train import run_training
        results = run_training()
        for g, m in results.items():
            log.info(
                "  %s → MAE=%,.0f | MAPE=%.1f%% | R²=%.4f",
                g, m['test_mae'], m['test_mape'], m['test_r2'],
            )
        log.info("  Re-entraînement terminé avec succès.")
    except Exception as e:
        log.error("  ERREUR lors du re-entraînement : %s", e, exc_info=True)


def task_collect_macro():
    """
    Collecte des données macro-économiques via l'API FRED/BLS.
    Nécessite la clé API FRED dans la variable d'environnement FRED_API_KEY.

    Cette tâche est optionnelle et échoue silencieusement si la clé n'est pas
    configurée.
    """
    import os
    import requests

    api_key = os.environ.get("FRED_API_KEY", "")
    if not api_key:
        log.warning("  FRED_API_KEY non définie — collecte macro ignorée")
        return

    log.info("  Collecte des données macro (FRED)…")
    try:
        # Exemple : unemployment rate (UNRATE)
        url = (
            f"https://api.stlouisfed.org/fred/series/observations"
            f"?series_id=UNRATE&api_key={api_key}&file_type=json"
            f"&observation_start=2020-01-01"
        )
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        obs  = data.get('observations', [])
        log.info("  FRED UNRATE : %d observations récupérées", len(obs))
        # TODO : merger avec us_labor_indicators.csv
    except Exception as e:
        log.error("  Erreur collecte FRED : %s", e)


def task_health_check():
    """
    Vérifie silencieusement l'existence et la fraîcheur des modèles.
    Log une alerte si un modèle est absent ou n'a pas été entraîné récemment.
    """
    log.info("  [health] Vérification des modèles…")
    for gran in ['quarterly', 'semester']:
        p = MODEL_DIR / f"model_{gran}.pkl"
        if not p.exists():
            log.warning("  [health] ALERTE : model_%s.pkl manquant !", gran)
        else:
            age_days = (datetime.now().timestamp() - p.stat().st_mtime) / 86400
            if age_days > 30:
                log.warning(
                    "  [health] model_%s.pkl vieux de %.0f jours — re-entraînement conseillé",
                    gran, age_days,
                )
            else:
                log.info("  [health] model_%s.pkl OK (%.1f jours)", gran, age_days)

    metrics_path = MODEL_DIR / "metrics.json"
    if metrics_path.exists():
        with open(metrics_path) as f:
            m = json.load(f)
        last = m.get('last_trained', 'inconnu')
        log.info("  [health] Dernier entraînement : %s", last)


# ── Planification ─────────────────────────────────────────────────────────────

def build_scheduler() -> BlockingScheduler:
    """
    Configure et retourne le scheduler APScheduler.

    Planning :
        - Lundi 03:00 → collecte macro (FRED)
        - Lundi 04:00 → re-entraînement XGBoost
        - Tous les jours 06:00 → health check
    """
    scheduler = BlockingScheduler(timezone="UTC")

    # Collecte macro : lundi à 03h00 UTC
    scheduler.add_job(
        task_collect_macro,
        trigger = CronTrigger(day_of_week='mon', hour=3, minute=0),
        id      = 'collect_macro',
        name    = 'Collecte données macro (FRED)',
        replace_existing=True,
    )

    # Re-entraînement : lundi à 04h00 UTC
    scheduler.add_job(
        task_retrain,
        trigger = CronTrigger(day_of_week='mon', hour=4, minute=0),
        id      = 'retrain',
        name    = 'Re-entraînement XGBoost',
        replace_existing=True,
    )

    # Health check : tous les jours à 06h00 UTC
    scheduler.add_job(
        task_health_check,
        trigger = CronTrigger(hour=6, minute=0),
        id      = 'health_check',
        name    = 'Health check modèles',
        replace_existing=True,
    )

    return scheduler


# ── Point d'entrée ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("Démarrage du scheduler AI Labor Market…")
    log.info("  → Re-entraînement : chaque lundi à 04h00 UTC")
    log.info("  → Collecte macro  : chaque lundi à 03h00 UTC")
    log.info("  → Health check    : tous les jours à 06h00 UTC")

    # Exécuter un health check immédiat au démarrage
    task_health_check()

    scheduler = build_scheduler()
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Scheduler arrêté.")
