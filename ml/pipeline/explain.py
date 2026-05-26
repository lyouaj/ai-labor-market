"""
Étape 3 — Explicabilité du modèle avec SHAP (SHapley Additive exPlanations).

Calcule les SHAP values (TreeExplainer) pour chaque feature sur le jeu de test
et sauvegarde un résumé JSON lisible par le frontend (section "Pourquoi cette
prédiction ?").
"""

import json
import logging
import numpy as np
from pathlib import Path

log = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"


def compute_shap(model, X_test, feature_cols: list, granularity: str = 'quarterly') -> dict:
    """
    Calcule les SHAP values et sauvegarde le résumé JSON.

    Le JSON sauvegardé est :
    {
      "granularity": "quarterly",
      "top_features": [
        {"feature": "lag_1", "importance": 0.34},
        ...
      ],
      "all_features": {"lag_1": 0.34, ...}
    }

    Args:
        model       : modèle XGBoost entraîné (XGBRegressor)
        X_test      : DataFrame des features du jeu de test
        feature_cols: liste ordonnée des noms de features
        granularity : 'quarterly' ou 'semester'

    Returns:
        shap_summary : dict complet (top_features + all_features)
    """
    try:
        import shap
    except ImportError:
        log.error("[SHAP] Le package 'shap' n'est pas installé. pip install shap>=0.44.0")
        return {}

    print(f"\n  [SHAP] Calcul des SHAP values — {granularity} ({len(X_test)} échantillons)…")

    # Limiter à 500 échantillons pour la performance
    X_sample = X_test.head(500) if len(X_test) > 500 else X_test

    try:
        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_sample)
    except Exception as e:
        log.error("[SHAP] Erreur lors du calcul : %s", e)
        return {}

    # Importance moyenne absolue par feature, normalisée en proportion (somme = 1)
    mean_abs = np.abs(shap_values).mean(axis=0)
    total    = mean_abs.sum()
    if total == 0:
        total = 1.0  # éviter la division par zéro

    importances = {
        col: round(float(mean_abs[i] / total), 4)
        for i, col in enumerate(feature_cols)
    }

    # Tri décroissant
    sorted_items = sorted(importances.items(), key=lambda x: x[1], reverse=True)

    top_features = [
        {"feature": name, "importance": imp}
        for name, imp in sorted_items[:10]
    ]

    shap_summary = {
        "granularity" : granularity,
        "top_features": top_features,
        "all_features": dict(sorted_items),
    }

    # Sauvegarde du résumé SHAP par granularité
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    shap_path = MODEL_DIR / f"shap_summary_{granularity}.json"
    with open(shap_path, 'w', encoding='utf-8') as f:
        json.dump(shap_summary, f, indent=2, ensure_ascii=False)
    print(f"  [OK] SHAP sauvegardé → shap_summary_{granularity}.json")

    # Compatibilité avec l'ancien format feature_importance.json
    fi_path = MODEL_DIR / "feature_importance.json"
    with open(fi_path, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted_items), f, indent=2, ensure_ascii=False)

    print("  Top 5 features :")
    for item in top_features[:5]:
        bar = "█" * int(item['importance'] * 50)
        print(f"    {item['feature']:30s} {item['importance']:.4f}  {bar}")

    return shap_summary


def load_shap_summary(granularity: str = 'quarterly') -> dict:
    """
    Charge le résumé SHAP sauvegardé depuis le JSON.

    Args:
        granularity: 'quarterly' ou 'semester'

    Returns:
        dict du résumé SHAP, ou dict vide si le fichier n'existe pas
    """
    path = MODEL_DIR / f"shap_summary_{granularity}.json"
    if not path.exists():
        log.warning("[SHAP] shap_summary_%s.json introuvable", granularity)
        return {}
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def get_shap_for_sector_country(sector: str, country: str, granularity: str = 'quarterly') -> dict:
    """
    Retourne le résumé SHAP filtré pour un secteur et un pays donnés.

    Note : les SHAP values sont calculées globalement sur le test set entier ;
    cette fonction retourne donc l'importance globale mais enrichit le contexte
    avec le secteur/pays demandé.

    Args:
        sector      : nom du secteur (ex. "Finance")
        country     : nom du pays (ex. "United States")
        granularity : 'quarterly' ou 'semester'

    Returns:
        dict avec top_features, all_features et contexte secteur/pays
    """
    summary = load_shap_summary(granularity)
    if not summary:
        return {}

    return {
        **summary,
        "sector" : sector,
        "country": country,
        "note"   : "Importances calculées sur l'ensemble du jeu de test (global).",
    }
