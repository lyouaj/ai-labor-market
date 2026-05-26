"""
Étape 1 — Préparation des features pour le modèle XGBoost.

Agrège les licenciements par (date, industry, country), ajoute les features
temporelles (lags, rolling, pct_change), calendaires, macro-économiques et
encode les variables catégorielles. Retourne X, y prêts pour l'entraînement.
"""

import logging
import pandas as pd
import numpy as np
import joblib
import warnings
from pathlib import Path
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings('ignore')

# ── Chemins ───────────────────────────────────────────────────────────────────
BASE_DIR     = Path(__file__).resolve().parent.parent.parent
DATASETS_DIR = BASE_DIR / "datasets"
MODEL_DIR    = BASE_DIR / "ml" / "models"

logging.basicConfig(level=logging.INFO, format="  %(message)s")
log = logging.getLogger(__name__)

# Colonnes macro attendues
MACRO_COLS = [
    'unemployment_rate', 'jolts_job_openings_k', 'claims_4w_avg',
    'openings_per_unemployed', 'tech_emp_yoy_pct', 'financial_emp_k',
    'information_sector_emp_k', 'computer_math_emp_k',
]

# Features fixes (sans macro, ajoutées dynamiquement)
BASE_FEATURE_COLS = [
    'lag_1', 'lag_2', 'lag_3', 'lag_6',
    'rolling_mean_3', 'rolling_std_3', 'rolling_mean_6',
    'pct_change_1', 'pct_change_3',
    'month', 'quarter_num', 'year', 'is_q1',
    'industry_encoded', 'country_encoded',
    'num_events', 'ai_events', 'avg_pct_workforce',
]


# ── Chargement des données ────────────────────────────────────────────────────

def _load_layoffs() -> pd.DataFrame:
    """Charge et nettoie le CSV des événements de licenciements."""
    path = DATASETS_DIR / "layoffs_events.csv"
    if not path.exists():
        raise FileNotFoundError(f"layoffs_events.csv introuvable : {path}")

    df = pd.read_csv(path)
    df['date'] = pd.to_datetime(df['date'], errors='coerce')

    # Nettoyage numérique
    df['layoff_count'] = (
        pd.to_numeric(df['layoff_count'], errors='coerce').fillna(0).astype(int)
    )
    df['pct_workforce'] = (
        pd.to_numeric(
            df['pct_workforce'].astype(str).str.replace('%', '', regex=False),
            errors='coerce',
        )
    )
    df['is_ai_company'] = (
        df['is_ai_company'].astype(str).str.strip().str.lower() == 'true'
    )

    # Harmonisation des noms
    df['country'] = df['country'].astype(str).str.strip().replace({
        'United Kingdo…': 'United Kingdom',
        'United Arab E…': 'United Arab Emirates',
    })
    df['industry'] = df['industry'].astype(str).str.strip().replace({
        'Transportat…': 'Transportation',
        'Infrastructu…': 'Infrastructure',
    })

    # Supprimer lignes sans date
    before = len(df)
    df = df.dropna(subset=['date']).reset_index(drop=True)
    dropped = before - len(df)
    if dropped:
        log.info("[load] layoffs — %d lignes supprimées car date=NaT", dropped)

    log.info(
        "[load] layoffs : %d lignes | %d pays | %d secteurs",
        len(df), df['country'].nunique(), df['industry'].nunique(),
    )
    return df


def _load_macro() -> pd.DataFrame:
    """Charge les indicateurs macro US (FRED / BLS)."""
    path = DATASETS_DIR / "us_labor_indicators.csv"
    if not path.exists():
        log.warning("[load] us_labor_indicators.csv introuvable — features macro désactivées")
        return pd.DataFrame(columns=['date'] + MACRO_COLS)

    df = pd.read_csv(path)
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    before = len(df)
    df = df.dropna(subset=['date']).reset_index(drop=True)
    if before - len(df):
        log.info("[load] macro — %d lignes supprimées car date=NaT", before - len(df))
    log.info("[load] macro US : %d lignes", len(df))
    return df


def _load_world_unemployment() -> pd.DataFrame:
    """Charge les indicateurs mondiaux de chômage (Banque Mondiale)."""
    path = DATASETS_DIR / "global_labor_indicators.csv"
    if not path.exists():
        log.warning("[load] global_labor_indicators.csv introuvable")
        return pd.DataFrame(columns=['country_name', 'year', 'unemployment_rate_pct'])
    df = pd.read_csv(path)
    log.info("[load] world unemployment : %d lignes | %d pays",
             len(df), df['country_name'].nunique() if 'country_name' in df.columns else 0)
    return df


# ── Agrégation ────────────────────────────────────────────────────────────────

def _aggregate_by_period(df_layoffs: pd.DataFrame, granularity: str) -> pd.DataFrame:
    """
    Agrège les licenciements par (période, industry, country).

    Args:
        df_layoffs: DataFrame nettoyé des événements
        granularity: 'quarterly' ou 'semester'

    Returns:
        DataFrame agrégé avec colonnes period, industry, country, layoff_count, …
    """
    df = df_layoffs.copy()

    if granularity == 'quarterly':
        df['period'] = df['date'].dt.to_period('Q').astype(str)
    elif granularity == 'semester':
        df['semester'] = df['date'].dt.month.map(lambda m: 1 if m <= 6 else 2)
        df['period'] = (
            df['date'].dt.year.astype(str) + '-S' + df['semester'].astype(str)
        )
    else:
        raise ValueError(f"granularity invalide : {granularity!r}. Valeurs : 'quarterly', 'semester'")

    agg = (
        df.groupby(['period', 'industry', 'country'])
        .agg(
            layoff_count      = ('layoff_count', 'sum'),
            num_events        = ('company', 'count'),
            ai_events         = ('is_ai_company', 'sum'),
            avg_pct_workforce = ('pct_workforce', 'mean'),
        )
        .reset_index()
    )
    agg = agg.sort_values(['country', 'industry', 'period']).reset_index(drop=True)
    log.info("[agg] %s : %d lignes agrégées", granularity, len(agg))
    return agg


# ── Features temporelles ──────────────────────────────────────────────────────

def _add_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ajoute les lags, rolling stats et pct_change groupés par (industry, country).

    Les calculs sont effectués dans l'ordre temporel au sein de chaque groupe
    pour éviter la fuite de données (data leakage).
    """
    group_cols = ['industry', 'country']
    df = df.sort_values(group_cols + ['period']).reset_index(drop=True)
    g = df.groupby(group_cols)['layoff_count']

    # Lags — décalage pur (passé immédiat)
    df['lag_1'] = g.shift(1)
    df['lag_2'] = g.shift(2)
    df['lag_3'] = g.shift(3)
    df['lag_6'] = g.shift(6)

    # Moyennes glissantes calculées sur les données PASSÉES (shift(1) avant rolling)
    df['rolling_mean_3'] = g.transform(
        lambda x: x.shift(1).rolling(3, min_periods=1).mean()
    )
    df['rolling_std_3'] = g.transform(
        lambda x: x.shift(1).rolling(3, min_periods=2).std()
    )
    df['rolling_mean_6'] = g.transform(
        lambda x: x.shift(1).rolling(6, min_periods=1).mean()
    )

    # Variations en pourcentage
    df['pct_change_1'] = g.pct_change(1)
    df['pct_change_3'] = g.pct_change(3)

    # Stabilisation numérique
    df['rolling_std_3']  = df['rolling_std_3'].fillna(0)
    df['pct_change_1']   = df['pct_change_1'].clip(-5, 5).fillna(0)
    df['pct_change_3']   = df['pct_change_3'].clip(-5, 5).fillna(0)

    return df


def _add_calendar_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ajoute les features calendaires extraites de la colonne 'period'.

    Supporte les formats : '2024Q1', '2024-S1'.
    """
    df['year'] = df['period'].str[:4].astype(int)

    if df['period'].str.contains('Q', na=False).any():
        # Trimestre : '2024Q1' ou '2024Q2' …
        df['quarter_num'] = df['period'].str.extract(r'Q(\d)').astype(float).astype('Int64')
        df['month']       = (df['quarter_num'] * 3 - 1).astype('Int64')
    else:
        # Semestre : '2024-S1' ou '2024-S2'
        df['quarter_num'] = (df['period'].str.extract(r'S(\d)').astype(float) * 2 - 1).astype('Int64')
        df['month']       = (df['quarter_num'] * 3 - 1).astype('Int64')

    df['is_q1'] = (df['quarter_num'] == 1).astype(int)
    return df


# ── Features macro ────────────────────────────────────────────────────────────

def _add_macro_features(
    df: pd.DataFrame,
    df_macro: pd.DataFrame,
    granularity: str,
) -> pd.DataFrame:
    """
    Joint les features macro US et décale de +1 période (prédire le FUTUR
    avec les données ACTUELLES). Les colonnes manquantes sont remplacées par
    leur médiane historique pour garantir la robustesse du pipeline.
    """
    macro = df_macro.copy()
    macro = macro.dropna(subset=['date'])

    if macro.empty:
        log.warning("[macro] Aucune donnée macro disponible — features macro ignorées")
        return df

    # Agrégation par période
    if granularity == 'quarterly':
        macro['period'] = macro['date'].dt.to_period('Q').astype(str)
    else:
        macro['semester'] = macro['date'].dt.month.map(lambda m: 1 if m <= 6 else 2)
        macro['period'] = (
            macro['date'].dt.year.astype(str) + '-S' + macro['semester'].astype(str)
        )

    available = [c for c in MACRO_COLS if c in macro.columns]
    missing   = [c for c in MACRO_COLS if c not in macro.columns]
    if missing:
        log.warning("[macro] Colonnes absentes du CSV : %s", missing)

    macro_agg = macro.groupby('period')[available].median().reset_index()
    macro_agg = macro_agg.sort_values('period').reset_index(drop=True)

    # IMPORTANT : décalage +1 période (on utilise les macro actuelles pour prédire le futur)
    for col in available:
        macro_agg[col] = macro_agg[col].shift(1)

    # Remplissage des NaN par la médiane historique (robustesse)
    for col in available:
        median_val = macro_agg[col].median()
        n_nan = macro_agg[col].isna().sum()
        if n_nan:
            macro_agg[col] = macro_agg[col].fillna(median_val)
            log.info("[macro] %s : %d NaN remplacés par médiane %.2f", col, n_nan, median_val)

    df = df.merge(macro_agg[['period'] + available], on='period', how='left')

    # Remplissage des NaN résiduels après le merge (périodes sans macro)
    for col in available:
        n_nan = df[col].isna().sum()
        if n_nan:
            fill_val = df[col].median()
            df[col] = df[col].fillna(fill_val)
            log.info("[fill] %s : %d NaN après merge → médiane %.2f", col, n_nan, fill_val)

    return df


# ── Encodage catégoriel ───────────────────────────────────────────────────────

def _encode_categoricals(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Encode 'industry' et 'country' avec LabelEncoder apres normalisation casse.

    Les chaines sont mises en minuscules avant l'encodage (correction 2) pour
    eviter tout mismatch de casse entre training et inference.
    Les classes connues sont sauvegardees dans encoders.pkl pour validation.
    """
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # Normaliser la casse AVANT d'encoder (meme chose sera fait en inference)
    df['industry'] = df['industry'].astype(str).str.strip().str.lower()
    df['country']  = df['country'].astype(str).str.strip().str.lower()

    le_industry = LabelEncoder()
    df['industry_encoded'] = le_industry.fit_transform(df['industry'])

    le_country = LabelEncoder()
    df['country_encoded']  = le_country.fit_transform(df['country'])

    # Sauvegarder encoders + listes de classes connues pour validation inference
    encoders = {
        'industry'        : le_industry,
        'country'         : le_country,
        'industry_classes': list(le_industry.classes_),
        'country_classes' : list(le_country.classes_),
    }
    joblib.dump(encoders, MODEL_DIR / "encoders.pkl")

    log.info(
        "[encode] %d industries | %d pays -> encoders.pkl (normalise en minuscules)",
        len(le_industry.classes_), len(le_country.classes_),
    )
    return df, encoders


# ── Pipeline principal ────────────────────────────────────────────────────────

def prepare_features(granularity: str = 'quarterly'):
    """
    Pipeline complet de préparation des features pour XGBoost.

    Args:
        granularity: 'quarterly' (trimestriel) ou 'semester' (semestriel)

    Returns:
        X           : DataFrame des features (sans NaN)
        y           : Series target = layoff_count période suivante (sans NaN)
        feature_cols: liste ordonnée des noms de colonnes features
        df_prepared : DataFrame complet avant split (conserve 'period', 'country', etc.)
    """
    print(f"\n{'='*60}")
    print(f"  PRÉPARATION DES FEATURES — {granularity.upper()}")
    print(f"{'='*60}")

    assert granularity in ('quarterly', 'semester'), \
        f"granularity doit être 'quarterly' ou 'semester', reçu : {granularity!r}"

    # ── 1. Chargement ────────────────────────────────────────
    df_layoffs = _load_layoffs()
    df_macro   = _load_macro()

    # ── 2. Agrégation par période ─────────────────────────────
    df = _aggregate_by_period(df_layoffs, granularity)

    # ── 3. Features temporelles ────────────────────────────────
    df = _add_lag_features(df)

    # ── 4. Features calendaires ────────────────────────────────
    df = _add_calendar_features(df)

    # ── 5. Features macro (avec décalage +1 période) ──────────
    df = _add_macro_features(df, df_macro, granularity)

    # ── 6. Encodage catégoriel ─────────────────────────────────
    df, encoders = _encode_categoricals(df)

    # ── 7. Target : layoff_count de la période SUIVANTE ────────
    df['target'] = df.groupby(['industry', 'country'])['layoff_count'].shift(-1)

    # ── 8. Nettoyage des lignes critiques avec NaN ─────────────
    critical_cols = ['lag_1', 'target']
    before = len(df)
    df = df.dropna(subset=critical_cols).reset_index(drop=True)
    dropped = before - len(df)
    log.info(
        "[clean] %d lignes supprimees car NaN dans %s (lags insuffisants ou derniere periode)",
        dropped, critical_cols,
    )

    # ── 8b. Filtrage des paires inactives ─────────────────────
    # Garder uniquement les lignes où lag_1 OU target sont > 0.
    # Les paires (country, industry, period) avec layoff_count=0 sur plusieurs
    # périodes consécutives créent des MAPE artificiellement élevés et ne
    # contribuent pas à la prédiction des événements réels.
    active_mask = (df['lag_1'] > 0) | (df['target'] > 0)
    n_inactive  = (~active_mask).sum()
    df = df[active_mask].reset_index(drop=True)
    log.info(
        "[filter] %d lignes inactives supprimees (lag_1=0 ET target=0) -> %d actives",
        n_inactive, len(df),
    )

    # ── 9. Definition des colonnes features ───────────────────
    feature_cols = list(BASE_FEATURE_COLS)  # copie

    # Ajouter les colonnes macro effectivement presentes dans le DataFrame
    for col in MACRO_COLS:
        if col in df.columns and col not in feature_cols:
            feature_cols.append(col)

    # ── CORRECTION 1 : nettoyage NaN complet avant d'exposer X / y ───────────

    # 1a. Supprimer les lignes ou la TARGET est NaN
    before = len(df)
    df = df.dropna(subset=['target'])
    if len(df) < before:
        log.info("[C1] %d lignes supprimees car target=NaN", before - len(df))

    # 1b. Supprimer les lignes ou les lags essentiels sont NaN
    essential = ['lag_1', 'lag_2', 'lag_3', 'rolling_mean_3']
    before = len(df)
    df = df.dropna(subset=essential)
    if len(df) < before:
        log.info("[C1] %d lignes supprimees car lags essentiels NaN", before - len(df))

    # 1c. Pour les features macro manquantes -> remplacer par mediane
    for col in MACRO_COLS:
        if col in df.columns and df[col].isna().any():
            med = df[col].median()
            n   = df[col].isna().sum()
            df[col] = df[col].fillna(med)
            log.info("[C1] %s : %d NaN -> mediane %.4f", col, n, med)

    # 1d. Fillna residuel sur toutes les features -> 0
    df[feature_cols] = df[feature_cols].fillna(0)

    X = df[feature_cols].copy()
    y = df['target'].copy()

    # 1e. Verification finale — logger si NaN restants
    nan_count = X.isnull().sum().sum() + y.isnull().sum()
    print(f"NaN restants apres nettoyage : {nan_count}")
    if nan_count > 0:
        print(X.isnull().sum()[X.isnull().sum() > 0])

    # Assert de securite — crash propre si NaN restants
    assert X.isnull().sum().sum() == 0, "ERREUR : NaN dans X avant entrainement"
    assert y.isnull().sum() == 0,       "ERREUR : NaN dans y avant entrainement"

    print(f"\n  [OK] X : {X.shape}  |  y : {len(y)} echantillons actifs")
    print(f"  [OK] Features : {len(feature_cols)} colonnes")
    nonzero_pct = (y > 0).mean() * 100
    print(
        f"  [OK] Target - mean={y.mean():.0f} | std={y.std():.0f} "
        f"| min={y.min():.0f} | max={y.max():.0f} | non-zero={nonzero_pct:.0f}%"
    )

    return X, y, feature_cols, df


# ── Point d'entrée ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    for gran in ['quarterly', 'semester']:
        X, y, cols, df = prepare_features(gran)
        assert len(X) == len(y),            "X et y doivent avoir la même taille"
        assert not X.isna().any().any(),     "X ne doit pas contenir de NaN"
        assert not y.isna().any(),           "y ne doit pas contenir de NaN"
        assert 'lag_1' in X.columns,        "la feature lag_1 doit être présente"
        assert 'industry_encoded' in X.columns, "industry_encoded doit être présente"
        print(f"  [ASSERT OK] {gran} : {len(X)} échantillons | {len(cols)} features\n")
