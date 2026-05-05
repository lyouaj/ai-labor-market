from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class PredictionRequest(BaseModel):
    # Features required for prediction
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

class PredictionResponse(BaseModel):
    predicted_layoffs: float
    lower_bound: float
    upper_bound: float
    model_used: str
    feature_importance: Dict[str, float]

class ModelMetrics(BaseModel):
    best_model: str
    train_mae: float
    train_rmse: float
    cv_mae_mean: float
    
class AnalyticsSummary(BaseModel):
    total_layoffs: int
    total_companies: int
    ai_companies: int
    top_industries: List[Dict[str, Any]]
    top_countries: List[Dict[str, Any]]
    monthly_trend: List[Dict[str, Any]]
