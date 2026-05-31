"""
Étape 5 — API FastAPI : endpoints de prédiction, métriques, SHAP et retrain.

Tous les endpoints de la partie ML sont regroupés ici et montés sous /api
dans backend/main.py.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import Optional
from backend.services import DataStore, AnalyticsService, ExternalAPIService
from ml.pipeline.predict import Predictor
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
from pathlib import Path

router = APIRouter()

# ── Singletons — chargés une seule fois au démarrage ──────────────────────────
store     = DataStore()
analytics = AnalyticsService(store)
predictor = Predictor()
external_api = ExternalAPIService()


# ══════════════════════════════════════════════════════════════════════════════
# SECTION : FILTRES & DONNÉES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/filters", tags=["data"])
async def get_filters():
    """Retourne les listes de pays et secteurs disponibles pour les dropdowns."""
    return analytics.get_filter_options()


@router.get("/summary", tags=["data"])
async def get_summary(
    country    : Optional[str]  = None,
    industry   : Optional[str]  = None,
    start_date : Optional[str]  = None,
    end_date   : Optional[str]  = None,
    is_ai      : Optional[bool] = None,
):
    """KPIs globaux (total licenciements, événements, entreprises, pays)."""
    return analytics.get_summary(country, industry, start_date, end_date, is_ai)


@router.get("/monthly", tags=["data"])
async def get_monthly(
    country    : Optional[str]  = None,
    industry   : Optional[str]  = None,
    start_date : Optional[str]  = None,
    end_date   : Optional[str]  = None,
    is_ai      : Optional[bool] = None,
):
    """Tendance mensuelle agrégée des licenciements."""
    return analytics.get_monthly(country, industry, start_date, end_date, is_ai)


@router.get("/by-country", tags=["data"])
async def get_by_country(
    limit      : int            = Query(10, ge=1, le=50),
    industry   : Optional[str]  = None,
    start_date : Optional[str]  = None,
    end_date   : Optional[str]  = None,
    is_ai      : Optional[bool] = None,
):
    """Agrégation des licenciements par pays (top N)."""
    return analytics.get_by_country(limit, industry, start_date, end_date, is_ai)


@router.get("/by-industry", tags=["data"])
async def get_by_industry(
    limit      : int            = Query(10, ge=1, le=50),
    country    : Optional[str]  = None,
    start_date : Optional[str]  = None,
    end_date   : Optional[str]  = None,
    is_ai      : Optional[bool] = None,
):
    """Agrégation des licenciements par secteur (top N)."""
    return analytics.get_by_industry(limit, country, start_date, end_date, is_ai)


@router.get("/sentiment", tags=["data"])
async def get_sentiment(limit: int = Query(50, ge=1, le=100)):
    """Sentiment des actualités agrégé par mois."""
    return analytics.get_sentiment(limit)


@router.get("/events", tags=["data"])
async def get_events(
    page       : int            = Query(1, ge=1),
    limit      : int            = Query(20, ge=1, le=100),
    country    : Optional[str]  = None,
    industry   : Optional[str]  = None,
    start_date : Optional[str]  = None,
    end_date   : Optional[str]  = None,
    is_ai      : Optional[bool] = None,
):
    """Table paginée des événements de licenciements."""
    return analytics.get_top_events(
        page, limit, country, industry, start_date, end_date, is_ai
    )


@router.get("/country-features/{country}", tags=["data"])
async def get_country_features(country: str, industry: Optional[str] = None):
    """Features contextuelles pour un pays (et optionnellement un secteur)."""
    result = analytics.get_country_features(country, industry)
    if result is None:
        raise HTTPException(404, f"Pays '{country}' introuvable dans les données")
    return result


# ══════════════════════════════════════════════════════════════════════════════
# SECTION : PRÉDICTION ML
# ══════════════════════════════════════════════════════════════════════════════

class PredictRequest(BaseModel):
    """Corps de la requête POST /predict."""
    country     : str
    sector      : Optional[str] = None
    granularity : str = Field(default="quarterly", pattern="^(quarterly|semester)$")
    n_periods   : int = Field(default=3, ge=1, le=8)


@router.post("/predict", tags=["prediction"])
async def predict(req: PredictRequest):
    """
    Prédit les licenciements futurs pour un pays / secteur donné.

    Retourne les prédictions en cascade avec intervalle de confiance à 80 %,
    les facteurs explicatifs et une alerte de risque.
    """
    try:
        result = predictor.predict(
            country     = req.country,
            sector      = req.sector,
            granularity = req.granularity,
            n_periods   = req.n_periods,
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(503, f"Modèle non disponible : {e}")
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Erreur de prédiction : {e}")


class ForecastRequest(BaseModel):
    """Corps de la requête POST /forecast (compatibilité ancienne API)."""
    country  : str
    industry : Optional[str] = None
    period   : str = Field(default="quarterly", pattern="^(quarterly|semiannual)$")
    n_periods: Optional[int] = None


@router.post("/forecast", tags=["prediction"])
async def forecast(req: ForecastRequest):
    """
    Endpoint de compatibilité — utilise /predict en interne.
    Mappe 'semiannual' → 'semester' et calcule n_periods automatiquement.
    """
    granularity = "semester" if req.period == "semiannual" else "quarterly"
    default_n   = 4 if granularity == "quarterly" else 2
    n_periods   = req.n_periods if req.n_periods and 1 <= req.n_periods <= 8 else default_n
    try:
        result = predictor.predict(
            country     = req.country,
            sector      = req.industry,
            granularity = granularity,
            n_periods   = n_periods,
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(503, f"Modèle non disponible : {e}")
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION : LISTES DISPONIBLES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/sectors", tags=["meta"])
async def get_sectors():
    """Liste de tous les secteurs présents dans les données."""
    return predictor.get_available_sectors()


@router.get("/countries", tags=["meta"])
async def get_countries():
    """Liste de tous les pays présents dans les données."""
    return predictor.get_available_countries()


# ══════════════════════════════════════════════════════════════════════════════
# SECTION : INDICATEURS MACRO (pour overlay graphique)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/macro-trend", tags=["data"])
async def get_macro_trend():
    """Retourne les indicateurs macro agrégés par trimestre pour overlay."""
    try:
        base = Path(__file__).resolve().parent.parent
        macro_path = base / "datasets" / "us_labor_indicators.csv"
        if not macro_path.exists():
            raise HTTPException(404, "us_labor_indicators.csv introuvable")
        df = pd.read_csv(macro_path)
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df = df.dropna(subset=['date']).sort_values('date')
        df['quarter'] = df['date'].dt.to_period('Q')
        cols = ['unemployment_rate', 'jolts_job_openings_k', 'claims_4w_avg']
        available = [c for c in cols if c in df.columns]
        agg = df.groupby('quarter')[available].median().reset_index()
        agg['period'] = agg['quarter'].astype(str).apply(
            lambda x: f"Q{x[-1]}-{x[:4]}"
        )
        result = []
        for _, row in agg.iterrows():
            entry = {"period": row["period"]}
            for c in available:
                v = row[c]
                entry[c] = round(float(v), 2) if pd.notna(v) and np.isfinite(v) else None
            result.append(entry)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION : MÉTRIQUES & EXPLICABILITÉ
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/metrics", tags=["model"])
async def get_metrics():
    """
    Métriques de performance des modèles entraînés.

    Retourne MAE, MAPE, R² pour chaque granularité ainsi que la date
    du dernier entraînement.
    """
    m = predictor.get_metrics()
    q = m.get('quarterly', {})
    s = m.get('semester',  {})
    return {
        "MAE_quarterly"  : q.get('test_mae',   None),
        "MAPE_quarterly" : q.get('test_mape',  None),
        "R2_quarterly"   : q.get('test_r2',    None),
        "MAE_semester"   : s.get('test_mae',   None),
        "MAPE_semester"  : s.get('test_mape',  None),
        "R2_semester"    : s.get('test_r2',    None),
        "last_trained"   : m.get('last_trained', 'unknown'),
        "raw"            : m,
    }


@router.get("/shap/{granularity}", tags=["model"])
async def get_shap(granularity: str):
    """
    Résumé SHAP (feature importance expliquée) pour une granularité.

    Args:
        granularity: 'quarterly' ou 'semester'
    """
    if granularity not in ("quarterly", "semester"):
        raise HTTPException(400, "granularity doit être 'quarterly' ou 'semester'")
    result = predictor.get_shap(granularity)
    if not result:
        raise HTTPException(
            404,
            f"Aucune donnée SHAP pour {granularity}. "
            "Lancez un entraînement : POST /api/retrain"
        )
    return result


@router.get("/shap/{sector}/{country}", tags=["model"])
async def get_shap_for_sector_country(
    sector      : str,
    country     : str,
    granularity : str = Query(default="quarterly"),
):
    """
    Résumé SHAP filtré pour un secteur et un pays spécifiques.

    Note : les valeurs SHAP sont calculées globalement ; le secteur/pays
    sont ajoutés au contexte pour l'affichage frontend.
    """
    if granularity not in ("quarterly", "semester"):
        raise HTTPException(400, "granularity doit être 'quarterly' ou 'semester'")
    from ml.pipeline.explain import get_shap_for_sector_country
    result = get_shap_for_sector_country(sector, country, granularity)
    if not result:
        raise HTTPException(
            404,
            f"Aucune donnée SHAP pour granularity={granularity}. "
            "Lancez un entraînement : POST /api/retrain"
        )
    return result


# ══════════════════════════════════════════════════════════════════════════════
# SECTION : SANTÉ & RE-ENTRAÎNEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/health", tags=["system"])
async def health():
    """
    Health check de l'API et du modèle.

    Retourne le statut, si un modèle est chargé en mémoire et la date
    du dernier entraînement.
    """
    metrics = predictor.get_metrics()
    return {
        "status"           : "ok",
        "model_loaded"     : bool(predictor._models),
        "last_trained"     : metrics.get("last_trained", "unknown"),
        "models_available" : [k for k in metrics if k not in ("last_trained",)],
    }


@router.post("/retrain", tags=["system"])
async def retrain(background_tasks: BackgroundTasks):
    """
    Déclenche le ré-entraînement complet du pipeline XGBoost en arrière-plan.

    Le retrain inclut : préparation des features → entraînement → calcul SHAP.
    Les métriques sont rechargées automatiquement après l'entraînement.
    """
    def _run_retrain():
        try:
            from ml.pipeline.train import run_training
            run_training()
            predictor.reload_metadata()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("[retrain] Erreur : %s", e)

    background_tasks.add_task(_run_retrain)
    return {
        "status" : "accepted",
        "message": "Ré-entraînement lancé en arrière-plan. "
                   "Consultez GET /api/metrics dans quelques minutes.",
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECTION : REAL-TIME DATA (External APIs)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/news", tags=["realtime"])
async def get_market_news():
    """Fetch general job market / layoffs news from NewsAPI."""
    return await external_api.get_market_news()

@router.get("/trending-news", tags=["realtime"])
async def get_trending_news():
    """Fetch trending employment news from GNews."""
    return await external_api.get_trending_news()

@router.get("/world-economy", tags=["realtime"])
async def get_world_economy():
    """Fetch world unemployment data from World Bank API."""
    return await external_api.get_world_economy()
