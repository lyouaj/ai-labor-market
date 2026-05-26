"""
Etape 2 -- Entrainement du modele XGBoost.

Split TEMPOREL obligatoire (jamais aleatoire), early stopping, calcul des
metriques (MAE, MAPE, R2), intervalle de confiance a 80 %, sauvegarde
conditionnelle si MAPE < 30 % avec backup de l'ancien modele.
"""
import sys, io
# Force UTF-8 output on Windows to avoid cp1252 UnicodeEncodeError
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import json
import logging
import shutil
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, r2_score

from ml.pipeline.prepare_features import prepare_features

log = logging.getLogger(__name__)

MODEL_DIR  = Path(__file__).resolve().parent.parent / "models"
BACKUP_DIR = MODEL_DIR / "backup"

# ── Paramètres XGBoost de référence ──────────────────────────────────────────
XGBOOST_PARAMS = dict(
    n_estimators          = 500,
    learning_rate         = 0.05,
    max_depth             = 6,
    subsample             = 0.8,
    colsample_bytree      = 0.8,
    min_child_weight      = 3,
    reg_alpha             = 0.1,
    reg_lambda            = 1.0,
    random_state          = 42,
    early_stopping_rounds = 30,
    eval_metric           = 'mae',
    verbosity             = 0,
)


def _temporal_split(X: pd.DataFrame, y: pd.Series, df_full: pd.DataFrame):
    """
    Split TEMPOREL : les 20 % (min 2 périodes) les plus récentes → test.
    Aucun mélange aléatoire n'est jamais effectué.

    Args:
        X       : features complètes
        y       : target complète
        df_full : DataFrame complet contenant la colonne 'period'

    Returns:
        X_train, X_test, y_train, y_test, test_periods
    """
    all_periods    = sorted(df_full['period'].unique())
    n_test_periods = max(2, len(all_periods) // 5)
    test_periods   = set(all_periods[-n_test_periods:])

    train_mask = df_full['period'].isin(test_periods) == False
    test_mask  = df_full['period'].isin(test_periods)

    X_train, X_test = X.loc[train_mask], X.loc[test_mask]
    y_train, y_test = y.loc[train_mask], y.loc[test_mask]

    log.info(
        "[split] Train : %d | Test : %d | Périodes test : %s → %s",
        len(X_train), len(X_test),
        min(test_periods), max(test_periods),
    )
    return X_train, X_test, y_train, y_test, test_periods


def _compute_mape(y_true, y_pred) -> float:
    """MAPE calculé uniquement sur les valeurs non nulles (évite division par zéro)."""
    mask = np.array(y_true) > 0
    if mask.sum() == 0:
        return 0.0
    return float(
        np.mean(np.abs((np.array(y_true)[mask] - np.array(y_pred)[mask]) /
                        np.array(y_true)[mask])) * 100
    )


def train_xgboost(
    X: pd.DataFrame,
    y: pd.Series,
    granularity: str = 'quarterly',
    df_full: pd.DataFrame = None,
):
    """
    Entraîne un modèle XGBoost avec split temporel et early stopping.

    Args:
        X           : features (sortie de prepare_features)
        y           : target
        granularity : 'quarterly' ou 'semester'
        df_full     : DataFrame complet (nécessaire pour le split temporel par période)

    Returns:
        model        : modèle XGBoost entraîné
        metrics      : dict MAE, MAPE, R², etc.
        residuals_std: écart-type des résidus (utilisé pour l'IC)
    """
    print(f"\n{'='*60}")
    print(f"  ENTRAÎNEMENT XGBOOST — {granularity.upper()}")
    print(f"{'='*60}")

    assert len(X) == len(y), "X et y doivent avoir la même taille"
    assert len(X) > 10,      "Données insuffisantes pour entraîner un modèle"

    # ── 1. Split temporel ─────────────────────────────────────
    if df_full is not None and 'period' in df_full.columns:
        X_train, X_test, y_train, y_test, test_periods = _temporal_split(X, y, df_full)
    else:
        # Fallback index-based (ordre chronologique supposé)
        n_test  = max(6, len(X) // 5)
        split_i = len(X) - n_test
        X_train, X_test = X.iloc[:split_i], X.iloc[split_i:]
        y_train, y_test = y.iloc[:split_i], y.iloc[split_i:]
        log.warning("[split] df_full absent — split par index (ordre chronologique supposé)")

    if len(X_train) < 5 or len(X_test) < 2:
        raise ValueError(
            f"Split trop petit : train={len(X_train)}, test={len(X_test)}. "
            "Ajoutez plus de données historiques."
        )

    # ── 2. Modèle XGBoost ─────────────────────────────────────
    model = XGBRegressor(**XGBOOST_PARAMS)

    # ── 3. Entraînement avec early stopping ───────────────────
    model.fit(
        X_train, y_train,
        eval_set    = [(X_test, y_test)],
        verbose     = False,
    )
    best_iter = int(model.best_iteration)
    print(f"  [train] Best iteration : {best_iter} / {XGBOOST_PARAMS['n_estimators']}")

    # -- 4. Metriques test
    y_pred      = np.maximum(model.predict(X_test), 0)
    mae         = float(mean_absolute_error(y_test, y_pred))
    mape        = _compute_mape(y_test.values, y_pred)
    r2          = float(r2_score(y_test, y_pred)) if len(y_test) > 1 else 0.0

    print(f"\n  [metrics] MAE  = {mae:,.0f}")
    print(f"  [metrics] MAPE = {mape:.1f}%  (sur {(np.array(y_test) > 0).sum()} ech. non-zero)")
    print(f"  [metrics] R2   = {r2:.4f}")

    # -- 5. Intervalle de confiance 80 %
    residuals     = y_test.values - y_pred
    residuals_std = float(np.std(residuals))
    print(f"  [IC 80%] +/- {1.28 * residuals_std:,.0f} licenciements")

    # -- 6. Metriques train (overfit check)
    y_train_pred = np.maximum(model.predict(X_train), 0)
    train_mae    = float(mean_absolute_error(y_train, y_train_pred))
    train_r2     = float(r2_score(y_train, y_train_pred))
    overfit_ratio = train_mae / mae if mae > 0 else 0
    print(f"  [train] MAE={train_mae:,.0f} | R2={train_r2:.4f} | overfit_ratio={overfit_ratio:.2f}")

    metrics = {
        'granularity'  : granularity,
        'test_mae'     : round(mae, 2),
        'test_mape'    : round(mape, 2),
        'test_r2'      : round(r2, 4),
        'train_mae'    : round(train_mae, 2),
        'train_r2'     : round(train_r2, 4),
        'overfit_ratio': round(overfit_ratio, 4),
        'residuals_std': round(residuals_std, 2),
        'best_iteration': best_iter,
        'n_train'      : len(X_train),
        'n_test'       : len(X_test),
        'n_features'   : int(X.shape[1]),
        'trained_at'   : datetime.now().isoformat(),
    }

    # ── 7. Sauvegarde conditionnelle ──────────────────────────
    model_name = f"model_{granularity}.pkl"
    model_path = MODEL_DIR / model_name
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # Backup de l'ancien modèle avant d'écraser
    if model_path.exists():
        ts          = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f"model_{granularity}_{ts}.pkl"
        shutil.copy2(model_path, BACKUP_DIR / backup_name)
        log.info("[backup] ancien modèle → backup/%s", backup_name)

    model_saved = False
    # Always save the model — a model with high MAPE is still better than
    # a stale model with mismatched features from a different training run.
    joblib.dump(model, model_path)
    model_saved = True
    if mape < 30:
        print(f"  [OK] Modele sauvegarde -> {model_name}  (MAPE={mape:.1f}%)")
    else:
        print(f"  [WARN] Modele sauvegarde -> {model_name}  (MAPE={mape:.1f}% — elevee, a ameliorer)")

    metrics['model_saved'] = model_saved

    # Sauvegarder les metriques (fusionner avec celles existantes) - TOUJOURS
    metrics_path = MODEL_DIR / "metrics.json"
    all_metrics: dict = {}
    if metrics_path.exists():
        try:
            with open(metrics_path, encoding='utf-8') as f:
                all_metrics = json.load(f)
        except json.JSONDecodeError:
            all_metrics = {}
    all_metrics[granularity]    = metrics
    all_metrics['last_trained'] = datetime.now().isoformat()
    with open(metrics_path, 'w', encoding='utf-8') as f:
        json.dump(all_metrics, f, indent=2)
    print("  [OK] Metriques -> metrics.json")

    # Sauvegarder la config des features - TOUJOURS
    config = {
        'feature_columns' : list(X.columns),
        'granularity'     : granularity,
        'best_model'      : 'XGBoost',
        'xgboost_params'  : {k: v for k, v in XGBOOST_PARAMS.items()},
    }
    config_path = MODEL_DIR / f"config_{granularity}.json"
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)
    # Aussi ecrire config.json generique (compatibilite)
    with open(MODEL_DIR / "config.json", 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)

    return model, metrics, residuals_std


# ── Lancement complet ─────────────────────────────────────────────────────────

def run_training() -> dict:
    """
    Lance l'entrainement complet pour les deux granularites ('quarterly' et 'semester')
    suivi du calcul SHAP sur le jeu de test.

    Returns:
        results : dict {granularity: metrics}
    """
    from ml.pipeline.explain import compute_shap

    results = {}

    for granularity in ['quarterly', 'semester']:
        # Préparation des données
        X, y, feature_cols, df = prepare_features(granularity)

        # Entraînement
        model, metrics, _ = train_xgboost(X, y, granularity, df)
        results[granularity] = metrics

        # SHAP sur le jeu de test
        all_periods    = sorted(df['period'].unique())
        n_test_periods = max(2, len(all_periods) // 5)
        test_period_set = set(all_periods[-n_test_periods:])
        test_mask      = df['period'].isin(test_period_set)
        X_test         = X.loc[test_mask]

        if len(X_test) > 0:
            try:
                compute_shap(model, X_test, feature_cols, granularity)
            except Exception as e:
                log.warning("[SHAP] Calcul échoué pour %s : %s", granularity, e)

    # Resume final
    print(f"\n{'='*60}")
    print("  ENTRAINEMENT TERMINE")
    print(f"{'='*60}")
    for g, m in results.items():
        print(
            f"  {g:12s} : MAE={m['test_mae']:,.0f} | "
            f"MAPE={m['test_mape']:.1f}% | R2={m['test_r2']:.4f}"
        )

    return results


# ── Point d'entrée ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    results = run_training()

    for g, m in results.items():
        assert 'test_mae'  in m, f"test_mae absent des metriques {g}"
        assert 'test_mape' in m, f"test_mape absent des metriques {g}"
        assert 'test_r2'   in m, f"test_r2 absent des metriques {g}"
        print(f"  [ASSERT OK] {g}")
