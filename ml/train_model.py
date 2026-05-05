"""
Model Training Module
---------------------
Trains Random Forest and XGBoost models to predict layoffs.
Saves the best model and evaluation metrics.
"""

import numpy as np
import pandas as pd
import joblib
import json
from pathlib import Path
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler

from data_processing import build_training_dataset

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

# Feature columns for the model
FEATURE_COLS = [
    'num_events', 'ai_events', 'ai_ratio', 'avg_pct_workforce',
    'unique_industries', 'unique_countries',
    'unemployment_rate', 'jolts_job_openings_k',
    'openings_per_unemployed', 'tech_emp_yoy_pct',
    'avg_sentiment', 'negative_ratio', 'num_articles', 'layoff_articles',
    'layoffs_lag1', 'layoffs_lag2', 'layoffs_lag3',
    'layoffs_rolling3', 'events_lag1'
]

TARGET_COL = 'total_layoffs'


def prepare_data(df):
    """Prepare features and target."""
    # Fill any remaining NaN in features
    X = df[FEATURE_COLS].copy()
    X = X.fillna(0)
    y = df[TARGET_COL].copy()
    y = y.fillna(0)
    return X, y


def train_and_evaluate():
    """Train models and evaluate with time-series cross-validation."""
    print("=" * 60)
    print("  AI Labor Market - Model Training Pipeline")
    print("=" * 60)
    
    # Load data
    print("\n1. Loading and preparing data...")
    df = build_training_dataset()
    X, y = prepare_data(df)
    print(f"   Dataset: {X.shape[0]} samples, {X.shape[1]} features")
    print(f"   Target stats: mean={y.mean():.0f}, std={y.std():.0f}, min={y.min():.0f}, max={y.max():.0f}")
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=X.columns)
    
    # Time-series split
    n_splits = min(5, len(X) // 4)
    tscv = TimeSeriesSplit(n_splits=n_splits)
    
    # Models to evaluate
    models = {
        'RandomForest': RandomForestRegressor(
            n_estimators=200,
            max_depth=10,
            min_samples_split=3,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        ),
        'GradientBoosting': GradientBoostingRegressor(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            min_samples_split=3,
            min_samples_leaf=2,
            random_state=42
        )
    }
    
    results = {}
    
    print("\n2. Training and evaluating models...")
    for name, model in models.items():
        print(f"\n   Training {name}...")
        
        # Cross-validation
        cv_mae = -cross_val_score(model, X_scaled, y, cv=tscv, scoring='neg_mean_absolute_error')
        cv_rmse = np.sqrt(-cross_val_score(model, X_scaled, y, cv=tscv, scoring='neg_mean_squared_error'))
        
        # Train on full data for final model
        model.fit(X_scaled, y)
        y_pred = model.predict(X_scaled)
        
        # Full-data metrics
        mae = mean_absolute_error(y, y_pred)
        rmse = np.sqrt(mean_squared_error(y, y_pred))
        r2 = r2_score(y, y_pred)
        
        results[name] = {
            'model': model,
            'cv_mae_mean': cv_mae.mean(),
            'cv_mae_std': cv_mae.std(),
            'cv_rmse_mean': cv_rmse.mean(),
            'cv_rmse_std': cv_rmse.std(),
            'train_mae': mae,
            'train_rmse': rmse,
            'train_r2': r2
        }
        
        print(f"   CV MAE:  {cv_mae.mean():.0f} ± {cv_mae.std():.0f}")
        print(f"   CV RMSE: {cv_rmse.mean():.0f} ± {cv_rmse.std():.0f}")
        print(f"   Train MAE:  {mae:.0f}")
        print(f"   Train RMSE: {rmse:.0f}")
        print(f"   Train R²:   {r2:.4f}")
        
        # Feature importance
        if hasattr(model, 'feature_importances_'):
            importances = pd.Series(model.feature_importances_, index=FEATURE_COLS)
            importances = importances.sort_values(ascending=False)
            print(f"\n   Top 5 features:")
            for feat, imp in importances.head(5).items():
                print(f"     {feat}: {imp:.4f}")
    
    # Select best model (by CV MAE)
    best_name = min(results, key=lambda k: results[k]['cv_mae_mean'])
    best_model = results[best_name]['model']
    print(f"\n3. Best model: {best_name}")
    
    # Save model, scaler, and metrics
    print("\n4. Saving artifacts...")
    
    # Save model
    model_path = MODEL_DIR / "layoff_predictor.joblib"
    joblib.dump(best_model, model_path)
    print(f"   Model saved: {model_path}")
    
    # Save scaler
    scaler_path = MODEL_DIR / "scaler.joblib"
    joblib.dump(scaler, scaler_path)
    print(f"   Scaler saved: {scaler_path}")
    
    # Save feature importance
    importances = pd.Series(best_model.feature_importances_, index=FEATURE_COLS)
    importances = importances.sort_values(ascending=False)
    importance_path = MODEL_DIR / "feature_importance.json"
    importances.to_json(importance_path)
    print(f"   Feature importance saved: {importance_path}")
    
    # Save metrics
    metrics = {
        'best_model': best_name,
        'feature_columns': FEATURE_COLS,
        'target_column': TARGET_COL,
        'n_samples': int(X.shape[0]),
        'n_features': int(X.shape[1]),
        'models': {}
    }
    for name, res in results.items():
        metrics['models'][name] = {
            'cv_mae_mean': round(float(res['cv_mae_mean']), 2),
            'cv_mae_std': round(float(res['cv_mae_std']), 2),
            'cv_rmse_mean': round(float(res['cv_rmse_mean']), 2),
            'cv_rmse_std': round(float(res['cv_rmse_std']), 2),
            'train_mae': round(float(res['train_mae']), 2),
            'train_rmse': round(float(res['train_rmse']), 2),
            'train_r2': round(float(res['train_r2']), 4)
        }
    
    metrics_path = MODEL_DIR / "metrics.json"
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"   Metrics saved: {metrics_path}")
    
    # Save feature columns for the API
    config = {
        'feature_columns': FEATURE_COLS,
        'target_column': TARGET_COL,
        'best_model': best_name
    }
    config_path = MODEL_DIR / "config.json"
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"   Config saved: {config_path}")
    
    print("\n" + "=" * 60)
    print("  Training complete!")
    print("=" * 60)
    
    return best_model, scaler, results


if __name__ == "__main__":
    train_and_evaluate()
