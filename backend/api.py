from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from backend.services import DataStore, AnalyticsService, PredictorService
from pydantic import BaseModel, Field

router = APIRouter()

# Singletons — data loaded once at startup
store = DataStore()
analytics = AnalyticsService(store)
predictor = PredictorService()


# ── Filter options (for dropdowns) ─────────────────────
@router.get("/filters")
async def get_filters():
    return analytics.get_filter_options()


# ── KPI summary ───────────────────────────────────────
@router.get("/summary")
async def get_summary(
    country: Optional[str] = None,
    industry: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    is_ai: Optional[bool] = None,
):
    return analytics.get_summary(country, industry, start_date, end_date, is_ai)


# ── Monthly trend (aggregated) ────────────────────────
@router.get("/monthly")
async def get_monthly(
    country: Optional[str] = None,
    industry: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    is_ai: Optional[bool] = None,
):
    return analytics.get_monthly(country, industry, start_date, end_date, is_ai)


# ── By country (aggregated, limited) ──────────────────
@router.get("/by-country")
async def get_by_country(
    limit: int = Query(10, ge=1, le=50),
    industry: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    is_ai: Optional[bool] = None,
):
    return analytics.get_by_country(limit, industry, start_date, end_date, is_ai)


# ── By industry (aggregated, limited) ─────────────────
@router.get("/by-industry")
async def get_by_industry(
    limit: int = Query(10, ge=1, le=50),
    country: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    is_ai: Optional[bool] = None,
):
    return analytics.get_by_industry(limit, country, start_date, end_date, is_ai)


# ── Sentiment (aggregated) ────────────────────────────
@router.get("/sentiment")
async def get_sentiment(limit: int = Query(50, ge=1, le=100)):
    return analytics.get_sentiment(limit)


# ── Paginated events table ────────────────────────────
@router.get("/events")
async def get_events(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    country: Optional[str] = None,
    industry: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    is_ai: Optional[bool] = None,
):
    return analytics.get_top_events(page, limit, country, industry,
                                    start_date, end_date, is_ai)


# ── Country features (for prediction) ─────────────────
@router.get("/country-features/{country}")
async def get_country_features(country: str):
    result = analytics.get_country_features(country)
    if result is None:
        raise HTTPException(404, f"Country '{country}' not found")
    return result


# ── Prediction (lean input/output) ────────────────────
class PredictRequest(BaseModel):
    num_events: float
    ai_events: float
    ai_ratio: float
    avg_pct_workforce: float
    unique_industries: float
    unique_countries: float
    unemployment_rate: float
    jolts_job_openings_k: float
    openings_per_unemployed: float
    tech_emp_yoy_pct: float
    avg_sentiment: float
    negative_ratio: float
    num_articles: float
    layoff_articles: float
    layoffs_lag1: float
    layoffs_lag2: float
    layoffs_lag3: float
    layoffs_rolling3: float
    events_lag1: float


@router.post("/predict")
async def predict(req: PredictRequest):
    try:
        return predictor.predict(req.dict())
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Multi-period Forecast ─────────────────────────────
class ForecastRequest(BaseModel):
    country: str
    period: str = Field(default="quarterly", pattern="^(quarterly|semiannual)$")


@router.post("/forecast")
async def forecast(req: ForecastRequest):
    # Get country features
    country_data = analytics.get_country_features(req.country)
    if country_data is None:
        raise HTTPException(404, f"Country '{req.country}' not found")
    try:
        result = predictor.forecast(country_data["features"], req.period)
        result["context"] = country_data["context"]
        # Attach recent historical trend for chart
        result["historical"] = analytics.get_recent_monthly(6)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Model metrics ─────────────────────────────────────
@router.get("/metrics")
async def get_metrics():
    return predictor.metrics
