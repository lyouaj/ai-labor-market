import joblib
import json
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

ML_DIR = Path(__file__).resolve().parent.parent / "ml"
MODEL_DIR = ML_DIR / "models"
DATASETS_DIR = ML_DIR.parent / "datasets"


class DataStore:
    """Singleton-like store: loads and cleans data once on startup."""

    def __init__(self):
        self.layoffs = self._load_layoffs()
        self.us_labor = self._load_us_labor()
        self.global_labor = pd.read_csv(DATASETS_DIR / "global_labor_indicators.csv")
        self.sentiment = self._load_sentiment()
        # Pre-compute filter options
        self.country_list = sorted(self.layoffs['country'].dropna().unique().tolist())
        self.industry_list = sorted(self.layoffs['industry'].dropna().unique().tolist())

    def _load_layoffs(self):
        df = pd.read_csv(DATASETS_DIR / "layoffs_events.csv")
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df['layoff_count'] = pd.to_numeric(df['layoff_count'], errors='coerce').fillna(0).astype(int)
        df['is_ai_company'] = df['is_ai_company'].astype(str).str.strip().str.lower() == 'true'
        df['country'] = df['country'].astype(str).str.strip().replace(
            {'United Kingdo…': 'United Kingdom', 'United Arab E…': 'United Arab Emirates'})
        df['industry'] = df['industry'].astype(str).str.strip().replace(
            {'Transportat…': 'Transportation', 'Infrastructu…': 'Infrastructure'})
        df['pct_workforce'] = df['pct_workforce'].astype(str).str.replace('%', '')
        df['pct_workforce'] = pd.to_numeric(df['pct_workforce'], errors='coerce')
        df['year_month'] = df['date'].dt.to_period('M').astype(str)
        df['year'] = df['date'].dt.year
        return df

    def _load_us_labor(self):
        df = pd.read_csv(DATASETS_DIR / "us_labor_indicators.csv")
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        return df

    def _load_sentiment(self):
        df = pd.read_csv(DATASETS_DIR / "news_sentiment.csv")
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df['year_month'] = df['date'].dt.to_period('M').astype(str)
        return df

    # ── Filtering helper ───────────────────────────────
    def filter_layoffs(self, country=None, industry=None,
                       start_date=None, end_date=None, is_ai=None):
        df = self.layoffs.copy()
        if country:
            df = df[df['country'] == country]
        if industry:
            df = df[df['industry'] == industry]
        if start_date:
            df = df[df['date'] >= pd.to_datetime(start_date)]
        if end_date:
            df = df[df['date'] <= pd.to_datetime(end_date)]
        if is_ai is not None:
            df = df[df['is_ai_company'] == is_ai]
        return df


class AnalyticsService:
    def __init__(self, store: DataStore):
        self.store = store

    def get_filter_options(self):
        return {
            "countries": self.store.country_list,
            "industries": self.store.industry_list,
        }

    def get_summary(self, country=None, industry=None,
                    start_date=None, end_date=None, is_ai=None):
        df = self.store.filter_layoffs(country, industry, start_date, end_date, is_ai)
        if df.empty:
            return {"total_layoffs": 0, "total_events": 0, "ai_events": 0,
                    "total_companies": 0, "total_countries": 0,
                    "avg_layoff_size": 0}
        return {
            "total_layoffs": int(df['layoff_count'].sum()),
            "total_events": len(df),
            "ai_events": int(df['is_ai_company'].sum()),
            "total_companies": int(df['company'].nunique()),
            "total_countries": int(df['country'].nunique()),
            "avg_layoff_size": int(df['layoff_count'].mean()),
        }

    def get_monthly(self, country=None, industry=None,
                    start_date=None, end_date=None, is_ai=None):
        df = self.store.filter_layoffs(country, industry, start_date, end_date, is_ai)
        if df.empty:
            return []
        df['ai_lc'] = df['layoff_count'] * df['is_ai_company']
        agg = df.groupby('year_month').agg(
            total=('layoff_count', 'sum'),
            ai=('ai_lc', 'sum'),
            events=('company', 'count'),
        ).reset_index().sort_values('year_month')
        return [{"month": r['year_month'], "total": int(r['total']),
                 "ai": int(r['ai']), "events": int(r['events'])}
                for _, r in agg.iterrows() if r['year_month'] != 'NaT']

    def get_by_country(self, limit=10, industry=None,
                       start_date=None, end_date=None, is_ai=None):
        df = self.store.filter_layoffs(None, industry, start_date, end_date, is_ai)
        if df.empty:
            return []
        agg = df.groupby('country').agg(
            total=('layoff_count', 'sum'),
            events=('company', 'count'),
        ).reset_index().sort_values('total', ascending=False).head(limit)
        return [{"country": r['country'], "total": int(r['total']),
                 "events": int(r['events'])} for _, r in agg.iterrows()]

    def get_by_industry(self, limit=10, country=None,
                        start_date=None, end_date=None, is_ai=None):
        df = self.store.filter_layoffs(country, None, start_date, end_date, is_ai)
        if df.empty:
            return []
        agg = df.groupby('industry').agg(
            total=('layoff_count', 'sum'),
            events=('company', 'count'),
        ).reset_index().sort_values('total', ascending=False).head(limit)
        return [{"industry": r['industry'], "total": int(r['total']),
                 "events": int(r['events'])} for _, r in agg.iterrows()]

    def get_sentiment(self, limit=50):
        sent = self.store.sentiment.copy()
        agg = sent.groupby('year_month').agg(
            sentiment=('sentiment', 'mean'),
            neg_ratio=('sentiment_cat', lambda x: round((x == 'negative').mean(), 3)),
            count=('title', 'count'),
        ).reset_index().sort_values('year_month').tail(limit)
        return [{"month": r['year_month'],
                 "sentiment": round(float(r['sentiment']), 3),
                 "neg_ratio": float(r['neg_ratio']),
                 "articles": int(r['count'])}
                for _, r in agg.iterrows()]

    def get_top_events(self, page=1, limit=20, country=None, industry=None,
                       start_date=None, end_date=None, is_ai=None):
        df = self.store.filter_layoffs(country, industry, start_date, end_date, is_ai)
        df = df.sort_values('layoff_count', ascending=False)
        total = len(df)
        start = (page - 1) * limit
        page_df = df.iloc[start:start + limit]
        rows = []
        for _, r in page_df.iterrows():
            rows.append({
                "company": str(r.get('company', '')),
                "country": str(r.get('country', '')),
                "industry": str(r.get('industry', '')),
                "layoff_count": int(r['layoff_count']),
                "date": r['date'].strftime('%Y-%m-%d') if pd.notna(r['date']) else '',
                "is_ai": bool(r['is_ai_company']),
            })
        return {"data": rows, "total": total, "page": page, "limit": limit,
                "pages": max(1, (total + limit - 1) // limit)}

    def get_recent_monthly(self, n=6):
        """Return the last N months of actual layoff data for chart context."""
        df = self.store.layoffs.copy()
        if df.empty:
            return []
        agg = df.groupby('year_month').agg(
            total=('layoff_count', 'sum'),
            events=('company', 'count'),
        ).reset_index().sort_values('year_month')
        recent = agg.tail(n)
        return [{"month": r['year_month'], "total": int(r['total']),
                 "events": int(r['events'])} for _, r in recent.iterrows()]

    def get_country_features(self, country: str):
        df = self.store.layoffs.copy()
        cdf = df[df['country'] == country]
        if cdf.empty:
            return None
        monthly = df.groupby('year_month').agg(
            total_layoffs=('layoff_count', 'sum'), num_events=('company', 'count'),
            ai_events=('is_ai_company', 'sum'), avg_pct_workforce=('pct_workforce', 'mean'),
            unique_industries=('industry', 'nunique'), unique_countries=('country', 'nunique'),
        ).reset_index().sort_values('year_month')
        latest = monthly.iloc[-1]
        prev1 = monthly.iloc[-2] if len(monthly) >= 2 else latest
        prev2 = monthly.iloc[-3] if len(monthly) >= 3 else latest
        prev3 = monthly.iloc[-4] if len(monthly) >= 4 else latest
        us = self.store.us_labor.sort_values('date')
        ul = us.iloc[-1] if len(us) > 0 else None
        sent = self.store.sentiment.copy()
        sm = sent.groupby('year_month').agg(
            avg_sentiment=('sentiment', 'mean'),
            negative_ratio=('sentiment_cat', lambda x: (x == 'negative').mean()),
            num_articles=('title', 'count'),
            layoff_articles=('is_layoff_news', 'sum'),
        ).reset_index().sort_values('year_month')
        sl = sm.iloc[-1] if len(sm) > 0 else None
        r3 = monthly.tail(3)['total_layoffs'].mean()
        ne = int(latest['num_events'])
        ae = int(latest['ai_events'])
        features = {
            "num_events": ne, "ai_events": ae,
            "ai_ratio": round(ae / max(ne, 1), 3),
            "avg_pct_workforce": round(float(latest.get('avg_pct_workforce', 15)), 2),
            "unique_industries": int(latest.get('unique_industries', 10)),
            "unique_countries": int(latest.get('unique_countries', 10)),
            "unemployment_rate": round(float(ul['unemployment_rate']), 2) if ul is not None else 4.0,
            "jolts_job_openings_k": round(float(ul.get('jolts_job_openings_k', 8000)), 1) if ul is not None else 8000,
            "openings_per_unemployed": round(float(ul.get('openings_per_unemployed', 1.2)), 2) if ul is not None else 1.2,
            "tech_emp_yoy_pct": round(float(ul.get('tech_emp_yoy_pct', 1.0)), 2) if ul is not None else 1.0,
            "avg_sentiment": round(float(sl['avg_sentiment']), 3) if sl is not None else 0.0,
            "negative_ratio": round(float(sl['negative_ratio']), 3) if sl is not None else 0.3,
            "num_articles": int(sl['num_articles']) if sl is not None else 10,
            "layoff_articles": int(sl['layoff_articles']) if sl is not None else 3,
            "layoffs_lag1": int(prev1['total_layoffs']),
            "layoffs_lag2": int(prev2['total_layoffs']),
            "layoffs_lag3": int(prev3['total_layoffs']),
            "layoffs_rolling3": round(float(r3), 1),
            "events_lag1": int(prev1['num_events']),
        }
        ti = cdf.groupby('industry')['layoff_count'].sum().sort_values(ascending=False)
        context = {
            "country": country,
            "country_total_layoffs": int(cdf['layoff_count'].sum()),
            "country_total_events": len(cdf),
            "country_ai_events": int(cdf['is_ai_company'].sum()),
            "country_top_industry": ti.index[0] if len(ti) > 0 else "N/A",
        }
        return {"features": features, "context": context}


class PredictorService:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.config = {}
        self.feature_importance = {}
        self.metrics = {}
        try:
            self.model = joblib.load(MODEL_DIR / "layoff_predictor.joblib")
            self.scaler = joblib.load(MODEL_DIR / "scaler.joblib")
            with open(MODEL_DIR / "config.json") as f:
                self.config = json.load(f)
            with open(MODEL_DIR / "feature_importance.json") as f:
                self.feature_importance = json.load(f)
            with open(MODEL_DIR / "metrics.json") as f:
                self.metrics = json.load(f)
            print("ML models loaded.")
        except Exception as e:
            print(f"ML load error: {e}")

    def predict(self, data: dict):
        if not self.model or not self.scaler:
            raise Exception("Model not loaded.")
        cols = self.config.get("feature_columns", [])
        df = pd.DataFrame([data])[cols]
        X = self.scaler.transform(df)
        pred = float(self.model.predict(X)[0])
        rmse = self.metrics.get('models', {}).get(
            self.metrics.get('best_model'), {}).get('cv_rmse_mean', 0)
        return {
            "predicted_layoffs": max(0, pred),
            "lower_bound": max(0, pred - rmse),
            "upper_bound": max(0, pred + rmse),
            "model_used": self.config.get('best_model', 'Unknown'),
            "feature_importance": self.feature_importance,
        }

    def forecast(self, base_features: dict, period: str = "quarterly"):
        """
        Generate multi-period forecasts.
        period: 'quarterly' = 4 future periods (one per month for a quarter)
                'semiannual' = 6 future periods (one per month for 6 months)
        Each step feeds the predicted value back as lag features.
        """
        if not self.model or not self.scaler:
            raise Exception("Model not loaded.")

        cols = self.config.get("feature_columns", [])
        n_periods = 3 if period == "quarterly" else 6
        rmse = self.metrics.get('models', {}).get(
            self.metrics.get('best_model'), {}).get('cv_rmse_mean', 0)

        predictions = []
        current = dict(base_features)

        for i in range(n_periods):
            df = pd.DataFrame([current])[cols]
            X = self.scaler.transform(df)
            pred = max(0, float(self.model.predict(X)[0]))

            # Increase uncertainty as we go further out
            uncertainty = rmse * (1 + i * 0.25)

            predictions.append({
                "period_index": i + 1,
                "predicted_layoffs": round(pred),
                "lower_bound": round(max(0, pred - uncertainty)),
                "upper_bound": round(pred + uncertainty),
            })

            # Shift lag features forward for next prediction
            current["layoffs_lag3"] = current.get("layoffs_lag2", pred)
            current["layoffs_lag2"] = current.get("layoffs_lag1", pred)
            current["layoffs_lag1"] = pred
            # Rolling 3 uses last 3 predictions
            recent = [p["predicted_layoffs"] for p in predictions[-3:]]
            current["layoffs_rolling3"] = round(sum(recent) / len(recent), 1)
            current["events_lag1"] = current.get("num_events", 10)

        return {
            "period": period,
            "n_periods": n_periods,
            "predictions": predictions,
            "model_used": self.config.get('best_model', 'Unknown'),
            "feature_importance": self.feature_importance,
            "base_indicators": {
                "unemployment_rate": base_features.get("unemployment_rate", 0),
                "avg_sentiment": base_features.get("avg_sentiment", 0),
                "negative_ratio": base_features.get("negative_ratio", 0),
                "ai_ratio": base_features.get("ai_ratio", 0),
                "layoffs_lag1": base_features.get("layoffs_lag1", 0),
                "layoffs_rolling3": base_features.get("layoffs_rolling3", 0),
            },
        }
