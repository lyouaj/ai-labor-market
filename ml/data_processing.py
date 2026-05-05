"""
Data Processing Module
-----------------------
Loads, cleans, and merges all datasets for analysis and model training.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

DATASETS_DIR = Path(__file__).resolve().parent.parent / "datasets"


def load_layoffs():
    """Load and clean layoffs events data."""
    df = pd.read_csv(DATASETS_DIR / "layoffs_events.csv")
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month
    df['year_month'] = df['date'].dt.to_period('M').astype(str)
    
    # Clean layoff_count
    df['layoff_count'] = pd.to_numeric(df['layoff_count'], errors='coerce')
    
    # Clean raised_mm
    df['raised_mm'] = df['raised_mm'].astype(str).str.replace(r'[\$,\s]', '', regex=True)
    df['raised_mm'] = pd.to_numeric(df['raised_mm'], errors='coerce')
    
    # Clean pct_workforce
    df['pct_workforce'] = df['pct_workforce'].astype(str).str.replace('%', '')
    df['pct_workforce'] = pd.to_numeric(df['pct_workforce'], errors='coerce')
    
    # Clean is_ai_company
    df['is_ai_company'] = df['is_ai_company'].astype(str).str.strip().str.lower() == 'true'
    
    # Clean country
    df['country'] = df['country'].astype(str).str.strip()
    # Normalize truncated country names
    df['country'] = df['country'].replace({
        'United Kingdo…': 'United Kingdom',
        'United Arab E…': 'United Arab Emirates'
    })
    
    # Clean industry
    df['industry'] = df['industry'].astype(str).str.strip()
    df['industry'] = df['industry'].replace({
        'Transportat…': 'Transportation',
        'Infrastructu…': 'Infrastructure'
    })
    
    return df


def load_us_labor():
    """Load US labor indicators."""
    df = pd.read_csv(DATASETS_DIR / "us_labor_indicators.csv")
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month
    df['year_month'] = df['date'].dt.to_period('M').astype(str)
    return df


def load_global_labor():
    """Load global labor indicators."""
    df = pd.read_csv(DATASETS_DIR / "global_labor_indicators.csv")
    return df


def load_sentiment():
    """Load news sentiment data."""
    df = pd.read_csv(DATASETS_DIR / "news_sentiment.csv")
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month
    df['year_month'] = df['date'].dt.to_period('M').astype(str)
    return df


def get_monthly_layoffs(layoffs_df):
    """Aggregate layoffs by month."""
    monthly = layoffs_df.groupby('year_month').agg(
        total_layoffs=('layoff_count', 'sum'),
        num_events=('company', 'count'),
        ai_events=('is_ai_company', 'sum'),
        avg_pct_workforce=('pct_workforce', 'mean'),
        unique_industries=('industry', 'nunique'),
        unique_countries=('country', 'nunique')
    ).reset_index()
    monthly['ai_ratio'] = monthly['ai_events'] / monthly['num_events']
    return monthly


def get_monthly_sentiment(sentiment_df):
    """Aggregate sentiment by month."""
    monthly = sentiment_df.groupby('year_month').agg(
        avg_sentiment=('sentiment', 'mean'),
        num_articles=('title', 'count'),
        layoff_articles=('is_layoff_news', 'sum'),
        negative_ratio=('sentiment_cat', lambda x: (x == 'negative').mean())
    ).reset_index()
    return monthly


def get_monthly_us_labor(us_labor_df):
    """Get monthly US labor stats (first of month rows)."""
    monthly = us_labor_df[us_labor_df['date'].dt.day == 1].copy()
    monthly['year_month'] = monthly['date'].dt.to_period('M').astype(str)
    cols = ['year_month', 'unemployment_rate', 'jolts_job_openings_k',
            'initial_jobless_claims_k', 'openings_per_unemployed',
            'tech_emp_yoy_pct', 'claims_4w_avg']
    return monthly[cols].drop_duplicates(subset='year_month')


def build_training_dataset():
    """
    Build the merged training dataset for the ML model.
    Merges monthly layoffs, US labor indicators, and sentiment.
    """
    layoffs = load_layoffs()
    us_labor = load_us_labor()
    sentiment = load_sentiment()
    
    # Aggregate monthly
    monthly_layoffs = get_monthly_layoffs(layoffs)
    monthly_sentiment = get_monthly_sentiment(sentiment)
    monthly_us = get_monthly_us_labor(us_labor)
    
    # Merge
    merged = monthly_layoffs.merge(monthly_us, on='year_month', how='left')
    merged = merged.merge(monthly_sentiment, on='year_month', how='left')
    
    # Fill missing sentiment with 0
    merged['avg_sentiment'] = merged['avg_sentiment'].fillna(0)
    merged['negative_ratio'] = merged['negative_ratio'].fillna(0)
    merged['num_articles'] = merged['num_articles'].fillna(0)
    merged['layoff_articles'] = merged['layoff_articles'].fillna(0)
    
    # Add time-series features
    merged = merged.sort_values('year_month').reset_index(drop=True)
    merged['layoffs_lag1'] = merged['total_layoffs'].shift(1)
    merged['layoffs_lag2'] = merged['total_layoffs'].shift(2)
    merged['layoffs_lag3'] = merged['total_layoffs'].shift(3)
    merged['layoffs_rolling3'] = merged['total_layoffs'].rolling(3, min_periods=1).mean()
    merged['events_lag1'] = merged['num_events'].shift(1)
    
    # Forward fill labor indicators
    labor_cols = ['unemployment_rate', 'jolts_job_openings_k',
                  'initial_jobless_claims_k', 'openings_per_unemployed',
                  'tech_emp_yoy_pct', 'claims_4w_avg']
    merged[labor_cols] = merged[labor_cols].ffill()
    merged[labor_cols] = merged[labor_cols].bfill()
    
    # Drop rows without enough history
    merged = merged.dropna(subset=['layoffs_lag1']).reset_index(drop=True)
    
    return merged


def get_country_stats(layoffs_df):
    """Country-level layoff statistics."""
    stats = layoffs_df.groupby('country').agg(
        total_layoffs=('layoff_count', 'sum'),
        num_events=('company', 'count'),
        ai_events=('is_ai_company', 'sum'),
        avg_layoff_size=('layoff_count', 'mean'),
        top_industry=('industry', lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else 'Unknown'),
        num_industries=('industry', 'nunique')
    ).reset_index()
    stats['ai_ratio'] = stats['ai_events'] / stats['num_events']
    stats = stats.sort_values('total_layoffs', ascending=False)
    return stats


def get_industry_stats(layoffs_df):
    """Industry-level layoff statistics."""
    stats = layoffs_df.groupby('industry').agg(
        total_layoffs=('layoff_count', 'sum'),
        num_events=('company', 'count'),
        ai_events=('is_ai_company', 'sum'),
        avg_layoff_size=('layoff_count', 'mean'),
        num_countries=('country', 'nunique')
    ).reset_index()
    stats['ai_ratio'] = stats['ai_events'] / stats['num_events']
    stats = stats.sort_values('total_layoffs', ascending=False)
    return stats


if __name__ == "__main__":
    print("Loading datasets...")
    layoffs = load_layoffs()
    print(f"  Layoffs: {len(layoffs)} rows")
    
    us_labor = load_us_labor()
    print(f"  US Labor: {len(us_labor)} rows")
    
    global_labor = load_global_labor()
    print(f"  Global Labor: {len(global_labor)} rows")
    
    sentiment = load_sentiment()
    print(f"  Sentiment: {len(sentiment)} rows")
    
    print("\nBuilding training dataset...")
    training = build_training_dataset()
    print(f"  Training set: {len(training)} rows, {len(training.columns)} columns")
    print(f"  Columns: {list(training.columns)}")
    print(f"\n  Sample:\n{training.head()}")
