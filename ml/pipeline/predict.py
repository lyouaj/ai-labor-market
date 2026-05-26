"""
Étape 4 — Prédiction en cascade avec intervalle de confiance croissant.

Charge le bon modèle XGBoost (quarterly / semester), reconstruit les features
à partir des données réelles, prédit n_periods en cascade et retourne un JSON
structuré incluant les alertes et les facteurs explicatifs.
"""

import json
import logging
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from datetime import datetime, timezone

log = logging.getLogger(__name__)

BASE_DIR     = Path(__file__).resolve().parent.parent.parent
MODEL_DIR    = BASE_DIR / "ml" / "models"
DATASETS_DIR = BASE_DIR / "datasets"

# Valeurs de repli pour les features macro quand le CSV est indisponible
MACRO_FALLBACK = {
    'unemployment_rate'       : 4.0,
    'jolts_job_openings_k'    : 8000.0,
    'claims_4w_avg'           : 220.0,
    'openings_per_unemployed' : 1.2,
    'tech_emp_yoy_pct'        : 1.0,
    'financial_emp_k'         : 8800.0,
    'information_sector_emp_k': 2900.0,
    'computer_math_emp_k'     : 4300.0,
}


class Predictor:
    """
    Service de prédiction XGBoost avec chargement paresseux (lazy loading).

    Les modèles et encoders sont chargés depuis le disque uniquement lors du
    premier appel à predict(), pour ne pas ralentir le démarrage de l'API.
    """

    def __init__(self):
        self._models: dict   = {}
        self._encoders       = None
        self._metrics: dict  = {}
        self._shap: dict     = {}
        self._last_data      = None
        self._macro_latest   = None
        self._load_metadata()

    # ── Chargement des métadonnées ────────────────────────────────────────────

    def _load_metadata(self):
        """Charge les métriques et résumés SHAP (fichiers légers) au démarrage."""
        try:
            p = MODEL_DIR / "metrics.json"
            if p.exists():
                with open(p, encoding='utf-8') as f:
                    self._metrics = json.load(f)
            log.info("[predict] Métriques chargées.")
        except Exception as e:
            log.warning("[predict] Erreur chargement métriques : %s", e)

        for g in ['quarterly', 'semester']:
            p = MODEL_DIR / f"shap_summary_{g}.json"
            if p.exists():
                try:
                    with open(p, encoding='utf-8') as f:
                        self._shap[g] = json.load(f)
                except Exception as e:
                    log.warning("[predict] Erreur SHAP %s : %s", g, e)

    # ── Chargement paresseux ──────────────────────────────────────────────────

    def _ensure_model(self, granularity: str):
        """Charge le modèle XGBoost si pas déjà en mémoire."""
        if granularity in self._models:
            return self._models[granularity]
        model_path = MODEL_DIR / f"model_{granularity}.pkl"
        if not model_path.exists():
            raise FileNotFoundError(
                f"Modèle {model_path} introuvable. "
                "Lancez l'entraînement : POST /api/retrain"
            )
        model = joblib.load(model_path)
        self._models[granularity] = model
        log.info("[predict] Modèle %s chargé depuis %s", granularity, model_path)
        return model

    def _ensure_encoders(self) -> dict:
        """Charge les LabelEncoders si pas déjà en mémoire."""
        if self._encoders is not None:
            return self._encoders
        enc_path = MODEL_DIR / "encoders.pkl"
        if not enc_path.exists():
            raise FileNotFoundError(
                "encoders.pkl introuvable. "
                "Lancez l'entraînement : POST /api/retrain"
            )
        self._encoders = joblib.load(enc_path)
        return self._encoders

    def _get_feature_columns(self, granularity: str) -> list:
        """Retourne la liste ordonnée des features attendues par le modèle."""
        for fname in [f"config_{granularity}.json", "config.json"]:
            p = MODEL_DIR / fname
            if p.exists():
                try:
                    with open(p, encoding='utf-8') as f:
                        cfg = json.load(f)
                    cols = cfg.get('feature_columns', [])
                    if cols:
                        return cols
                except Exception:
                    pass
        return []

    # ── Données de référence ──────────────────────────────────────────────────

    def _get_last_data(self) -> pd.DataFrame:
        """Charge et met en cache les données de licenciements."""
        if self._last_data is not None:
            return self._last_data

        df = pd.read_csv(DATASETS_DIR / "layoffs_events.csv")
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df['layoff_count'] = pd.to_numeric(df['layoff_count'], errors='coerce').fillna(0).astype(int)
        df['pct_workforce'] = pd.to_numeric(
            df['pct_workforce'].astype(str).str.replace('%', '', regex=False),
            errors='coerce',
        )
        df['is_ai_company'] = df['is_ai_company'].astype(str).str.strip().str.lower() == 'true'
        df['country']  = df['country'].astype(str).str.strip().replace({
            'United Kingdo…': 'United Kingdom',
            'United Arab E…': 'United Arab Emirates',
        })
        df['industry'] = df['industry'].astype(str).str.strip().replace({
            'Transportat…': 'Transportation',
            'Infrastructu…': 'Infrastructure',
        })
        df = df.dropna(subset=['date']).reset_index(drop=True)
        self._last_data = df
        return df

    def _get_macro_latest(self) -> dict:
        """Récupère les dernières valeurs macro disponibles (avec fallback)."""
        if self._macro_latest is not None:
            return self._macro_latest
        try:
            macro = pd.read_csv(DATASETS_DIR / "us_labor_indicators.csv")
            macro['date'] = pd.to_datetime(macro['date'], errors='coerce')
            macro = macro.dropna(subset=['date']).sort_values('date')
            latest = macro.iloc[-1]
            result = {}
            for k, fallback in MACRO_FALLBACK.items():
                raw = latest.get(k, fallback)
                try:
                    v = float(raw)
                    result[k] = fallback if (np.isnan(v) or np.isinf(v)) else v
                except (TypeError, ValueError):
                    result[k] = fallback
            self._macro_latest = result
            return result
        except Exception as e:
            log.warning("[macro] Impossible de charger us_labor_indicators.csv : %s", e)
            return dict(MACRO_FALLBACK)

    def _get_sentiment_latest(self) -> dict:
        """Récupère les dernières valeurs de sentiment média."""
        try:
            sn = pd.read_csv(DATASETS_DIR / "news_sentiment.csv")
            sn['date'] = pd.to_datetime(sn['date'], errors='coerce')
            sn = sn.dropna(subset=['date']).sort_values('date')
            # Use last 3 months of data
            cutoff = sn['date'].max() - pd.Timedelta(days=90)
            recent = sn[sn['date'] >= cutoff]
            if recent.empty:
                recent = sn.tail(30)
            avg_sentiment  = float(recent['sentiment'].mean()) if 'sentiment' in recent else 0.0
            negative_ratio = float((recent['sentiment_cat'] == 'negative').mean()) if 'sentiment_cat' in recent else 0.0
            num_articles   = int(len(recent))
            layoff_articles = int(recent['is_layoff_news'].sum()) if 'is_layoff_news' in recent else 0
            return {
                'avg_sentiment' : round(avg_sentiment, 4),
                'negative_ratio': round(negative_ratio, 4),
                'num_articles'  : num_articles,
                'layoff_articles': layoff_articles,
            }
        except Exception as e:
            log.warning("[sentiment] Impossible de charger news_sentiment.csv : %s", e)
            return {'avg_sentiment': 0, 'negative_ratio': 0, 'num_articles': 0, 'layoff_articles': 0}

    # ── Construction du vecteur de features ──────────────────────────────────

    def _build_features(self, country: str, sector: str, granularity: str) -> tuple[dict, dict]:
        """
        Construit le vecteur de features pour la dernière période connue.

        Filtre les données par pays (et secteur si fourni), agrège par période,
        calcule les lags et les features rolling à partir des données réelles.

        Args:
            country     : nom du pays
            sector      : nom du secteur (ou None pour tout)
            granularity : 'quarterly' ou 'semester'

        Returns:
            features : dict {nom_feature: valeur}
            context  : dict d'informations contextuelles (non utilisées par le modèle)
        """
        df       = self._get_last_data()
        encoders = self._ensure_encoders()

        # Correction 2 : normaliser la casse exactement comme pendant l'entrainement
        country_norm = country.strip().lower()
        sector_norm  = sector.strip().lower() if sector else None

        # Validation contre les classes connues
        known_countries = encoders.get('country_classes', [])
        known_sectors   = encoders.get('industry_classes', [])

        if known_countries and country_norm not in known_countries:
            raise ValueError(
                f"Pays '{country}' inconnu. Pays disponibles : {known_countries[:10]}..."
            )
        if sector_norm and known_sectors and sector_norm not in known_sectors:
            raise ValueError(
                f"Secteur '{sector}' inconnu. Secteurs disponibles : {known_sectors[:10]}..."
            )

        # Filtre pays / secteur sur les donnees brutes (colonne en casse originale)
        mask = df['country'].str.strip().str.lower() == country_norm
        if sector_norm:
            mask &= df['industry'].str.strip().str.lower() == sector_norm
        cdf = df[mask].copy()

        if cdf.empty:
            raise ValueError(
                f"Aucune donnee pour country={country!r}, sector={sector!r}. "
                "Verifiez les filtres disponibles via GET /api/filters"
            )

        # Agrégation par période
        if granularity == 'quarterly':
            cdf['period'] = cdf['date'].dt.to_period('Q').astype(str)
        else:
            cdf['sem']    = cdf['date'].dt.month.map(lambda m: 1 if m <= 6 else 2)
            cdf['period'] = cdf['date'].dt.year.astype(str) + '-S' + cdf['sem'].astype(str)

        agg = (
            cdf.groupby('period')
            .agg(
                layoff_count      = ('layoff_count', 'sum'),
                num_events        = ('company', 'count'),
                ai_events         = ('is_ai_company', 'sum'),
                avg_pct_workforce = ('pct_workforce', 'mean'),
            )
            .reset_index()
            .sort_values('period')
            .reset_index(drop=True)
        )

        n = len(agg)
        if n < 1:
            raise ValueError(f"Données insuffisantes pour {country!r} / {sector!r}")

        # Lags (basés sur l'historique réel)
        lag_1 = float(agg.iloc[-1]['layoff_count'])
        lag_2 = float(agg.iloc[-2]['layoff_count']) if n >= 2 else lag_1
        lag_3 = float(agg.iloc[-3]['layoff_count']) if n >= 3 else lag_2
        lag_6 = float(agg.iloc[-6]['layoff_count']) if n >= 6 else lag_3

        # Rolling stats
        recent_3       = agg['layoff_count'].tail(3)
        rolling_mean_3 = float(recent_3.mean())
        rolling_std_3  = float(recent_3.std()) if len(recent_3) > 1 else 0.0
        recent_6       = agg['layoff_count'].tail(6)
        rolling_mean_6 = float(recent_6.mean())

        # Pct change
        pct_1 = float(np.clip((lag_1 / max(lag_2, 1)) - 1, -5, 5)) if lag_2 > 0 else 0.0
        pct_3 = float(np.clip((lag_1 / max(lag_3, 1)) - 1, -5, 5)) if lag_3 > 0 else 0.0

        # Features calendaires (basées sur la dernière période connue)
        last_period = str(agg.iloc[-1]['period'])
        year = int(last_period[:4])
        if 'Q' in last_period:
            q_num = int(last_period[-1])
        else:
            q_num = int(last_period[-1]) * 2 - 1
        month  = q_num * 3 - 1
        is_q1  = 1 if q_num == 1 else 0

        # Encodage categoriel (inputs deja normalises en minuscules)
        def _safe_encode(encoder, value: str, fallback: int = 0) -> int:
            try:
                return int(encoder.transform([value])[0])
            except (ValueError, KeyError):
                return fallback

        industry_enc = _safe_encode(encoders['industry'], sector_norm or 'unknown')
        country_enc  = _safe_encode(encoders['country'],  country_norm)

        # Features macro
        macro = self._get_macro_latest()

        latest_row = agg.iloc[-1]

        features = {
            # Lags temporels
            'lag_1'            : lag_1,
            'lag_2'            : lag_2,
            'lag_3'            : lag_3,
            'lag_6'            : lag_6,
            # Rolling
            'rolling_mean_3'   : rolling_mean_3,
            'rolling_std_3'    : rolling_std_3,
            'rolling_mean_6'   : rolling_mean_6,
            # Pct change
            'pct_change_1'     : pct_1,
            'pct_change_3'     : pct_3,
            # Calendaire
            'month'            : month,
            'quarter_num'      : q_num,
            'year'             : year,
            'is_q1'            : is_q1,
            # Catégoriel
            'industry_encoded' : industry_enc,
            'country_encoded'  : country_enc,
            # Agrégats bruts
            'num_events'       : int(latest_row['num_events']),
            'ai_events'        : int(latest_row['ai_events']),
            'avg_pct_workforce': float(latest_row.get('avg_pct_workforce') or 15.0),
            # Macro
            **macro,
        }

        # Sanitisation finale : remplacer NaN / Inf par 0
        features = {
            k: (0.0 if isinstance(v, float) and (np.isnan(v) or np.isinf(v)) else v)
            for k, v in features.items()
        }

        context = {
            'country'              : country,
            'industry'             : sector,
            'country_total_layoffs': int(cdf['layoff_count'].sum()),
            'country_total_events' : len(cdf),
            'country_ai_events'    : int(cdf['is_ai_company'].sum()),
            'country_top_industry' : (
                cdf.groupby('industry')['layoff_count'].sum().idxmax()
                if not cdf.empty else 'N/A'
            ),
            'country_industries'   : sorted(
                str(v) for v in df[df['country'] == country]['industry'].dropna().unique()
            ),
            'country_unemployment' : macro.get('unemployment_rate', 4.0),
        }

        return features, context

    # ── Prédiction en cascade ─────────────────────────────────────────────────

    def predict(
        self,
        country: str,
        sector: str,
        granularity: str = 'quarterly',
        n_periods: int = 3,
    ) -> dict:
        """
        Prédit n_periods en cascade avec intervalle de confiance croissant.

        Chaque prédiction devient le lag_1 de la prédiction suivante (cascade).
        L'incertitude s'élargit de 10 % par période supplémentaire.

        Args:
            country     : nom du pays (ex. "United States")
            sector      : nom du secteur (ex. "Finance") ou None
            granularity : 'quarterly' ou 'semester'
            n_periods   : nombre de périodes à prédire (max 8)

        Returns:
            dict JSON structuré avec predictions, top_factors, alert, etc.
        """
        assert granularity in ('quarterly', 'semester'), \
            f"granularity invalide : {granularity!r}"
        n_periods = min(max(n_periods, 1), 8)

        model        = self._ensure_model(granularity)
        feature_dict, context = self._build_features(country, sector, granularity)
        sentiment_data = self._get_sentiment_latest()
        expected_cols = self._get_feature_columns(granularity)

        if not expected_cols:
            expected_cols = list(feature_dict.keys())

        # Résidus pour l'IC à 80 %
        gran_metrics  = self._metrics.get(granularity, {})
        residuals_std = float(gran_metrics.get('residuals_std', 1000))
        mape          = float(gran_metrics.get('test_mape', 0))

        # ── Prédiction en cascade ─────────────────────────────
        predictions: list = []
        current = dict(feature_dict)

        for i in range(n_periods):
            # Construire le DataFrame dans l'ordre exact des colonnes du modele
            X_row = pd.DataFrame([current])
            for col in expected_cols:
                if col not in X_row.columns:
                    X_row[col] = 0
            X_row = X_row[expected_cols]

            # Correction 3 : guard NaN avant model.predict()
            nan_in_row = X_row.isnull().sum().sum()
            if nan_in_row > 0:
                log.warning("[predict] %d NaN dans X_pred periode %d -> remplaces par 0", nan_in_row, i + 1)
                X_row = X_row.fillna(0)

            pred = float(max(0, model.predict(X_row)[0]))

            # IC croissant : +10 % d'incertitude par période
            confidence = residuals_std * (1.0 + 0.10 * i)
            lower      = max(0.0, pred - 1.28 * confidence)
            upper      = pred + 1.28 * confidence

            # Label de période (ex. "Q3-2026")
            period_label = self._next_period_label(
                current.get('year', 2026),
                int(current.get('quarter_num', 1)),
                i,
                granularity,
            )

            # Tendance
            if i > 0:
                prev = predictions[-1]['predicted_layoffs']
                if   pred > prev * 1.05: trend = "hausse"
                elif pred < prev * 0.95: trend = "baisse"
                else:                    trend = "stable"
            else:
                trend = "initial"

            predictions.append({
                'period'           : period_label,
                'predicted_layoffs': round(pred),
                'lower_bound'      : round(lower),
                'upper_bound'      : round(upper),
                'confidence_pct'   : 80,
                'trend'            : trend,
            })

            # Correction 3 : mise a jour des lags pour la cascade (formule spec)
            prev_lag_1 = current.get('lag_1', pred)
            prev_lag_2 = current.get('lag_2', prev_lag_1)
            prev_lag_3 = current.get('lag_3', prev_lag_2)

            current['pct_change_3']   = float(np.clip((pred - prev_lag_3) / (prev_lag_3 + 1e-6), -5, 5))
            current['pct_change_1']   = float(np.clip((pred - prev_lag_1) / (prev_lag_1 + 1e-6), -5, 5))
            current['lag_6']          = current.get('lag_3', pred)
            current['lag_3']          = prev_lag_2
            current['lag_2']          = prev_lag_1
            current['lag_1']          = pred

            # Rolling mis a jour avec les predictions recentes
            l1, l2, l3               = pred, prev_lag_1, prev_lag_2
            current['rolling_mean_3'] = (l1 + l2 + l3) / 3
            current['rolling_std_3']  = float(pd.Series([l1, l2, l3]).std())
            recent_6_preds            = [p['predicted_layoffs'] for p in predictions[-6:]]
            current['rolling_mean_6'] = float(np.mean(recent_6_preds)) if recent_6_preds else l1

        # ── Facteurs explicatifs textuels ─────────────────────
        top_factors = self._generate_factors(feature_dict, predictions)

        # ── Alerte ───────────────────────────────────────────
        alert = self._generate_alert(predictions)

        # ── Feature importance (SHAP ou fallback XGBoost natif) ──
        fi = self._shap.get(granularity, {}).get('all_features', {})
        if not fi:
            fi = dict(zip(expected_cols, model.feature_importances_.tolist()))

        # ── Historique récent (pour graphique) ────────────────
        historical = self._get_recent_historical(country, sector, n=6)

        # ── Totaux (Correction 3) ──────────────────────────────
        total = sum(p['predicted_layoffs'] for p in predictions)
        months_per_period = 3 if granularity == 'quarterly' else 6
        monthly_avg = int(total / (n_periods * months_per_period))

        return {
            'country'          : country,
            'sector'           : sector,
            'granularity'      : granularity,
            'period'           : granularity,
            'generated_at'     : datetime.now(timezone.utc).isoformat(),
            'model_used'       : 'XGBoost',
            'model_mape'       : mape,
            'n_periods'        : n_periods,
            'total_predicted'  : total,
            'monthly_average'  : monthly_avg,
            'predictions'      : predictions,
            'top_factors'      : top_factors,
            'alert'            : alert,
            'feature_importance': fi,
            'base_indicators'  : {
                'unemployment_rate'  : feature_dict.get('unemployment_rate', 0),
                'avg_sentiment'      : sentiment_data.get('avg_sentiment', 0),
                'negative_ratio'     : sentiment_data.get('negative_ratio', 0),
                'ai_ratio'           : (
                    feature_dict.get('ai_events', 0) /
                    max(feature_dict.get('num_events', 1), 1)
                ),
                'layoffs_lag1'       : feature_dict.get('lag_1', 0),
                'layoffs_rolling3'   : feature_dict.get('rolling_mean_3', 0),
            },
            'context'  : context,
            'historical': historical,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _next_period_label(base_year: int, base_q: int, offset: int, granularity: str) -> str:
        """Génère le label de la période suivante (ex. 'Q3-2026', 'S2-2026')."""
        if granularity == 'quarterly':
            total_q    = base_q + offset
            year_delta = (total_q - 1) // 4
            q          = ((total_q - 1) % 4) + 1
            return f"Q{q}-{base_year + year_delta}"
        else:
            total_s    = base_q + offset  # base_q = 1 ou 2 pour un semestre
            year_delta = (total_s - 1) // 2
            s          = ((total_s - 1) % 2) + 1
            return f"S{s}-{base_year + year_delta}"

    def _generate_factors(self, features: dict, predictions: list) -> list:
        """Génère une explication textuelle des 5 facteurs les plus influents."""
        factors = []

        ur = features.get('unemployment_rate', 0)
        if ur > 5:
            factors.append(f"Taux de chômage élevé ({ur:.1f}%)")
        elif ur < 3.5:
            factors.append(f"Marché du travail tendu ({ur:.1f}%)")

        lag1, lag2 = features.get('lag_1', 0), features.get('lag_2', 0)
        if lag2 > 0:
            if lag1 > lag2 * 1.10:
                factors.append(
                    f"Hausse récente des licenciements (+{((lag1/lag2)-1)*100:.0f}%)"
                )
            elif lag1 < lag2 * 0.90:
                factors.append(
                    f"Baisse récente des licenciements ({((lag1/lag2)-1)*100:.0f}%)"
                )

        if features.get('is_q1', 0):
            factors.append("Pic saisonnier Q1 historique (janvier)")

        jolts = features.get('jolts_job_openings_k', 0)
        if jolts < 7000:
            factors.append(f"Offres d'emploi JOLTS faibles ({jolts:,.0f}k)")

        claims = features.get('claims_4w_avg', 0)
        if claims > 250:
            factors.append(f"Allocations chômage hebdomadaires élevées ({claims:,.0f}k)")

        if len(predictions) >= 2:
            first, last = predictions[0]['predicted_layoffs'], predictions[-1]['predicted_layoffs']
            if last > first * 1.10:
                factors.append("Tendance haussière sur toute la période de prévision")
            elif last < first * 0.90:
                factors.append("Tendance baissière sur toute la période de prévision")

        return factors[:5]

    def _generate_alert(self, predictions: list) -> str | None:
        """Génère une alerte basée sur la tendance des prédictions."""
        if len(predictions) < 2:
            return None
        ups = sum(
            1 for i in range(1, len(predictions))
            if predictions[i]['predicted_layoffs'] > predictions[i-1]['predicted_layoffs']
        )
        ratio = ups / (len(predictions) - 1)
        if ratio >= 1.0:
            return "Risque ÉLEVÉ — licenciements en hausse continue sur toute la période"
        elif ratio >= 0.5:
            return "Risque MODÉRÉ — tendance globalement haussière"
        elif ratio <= 0.0:
            return "Signal POSITIF — tendance baissière des licenciements"
        return None

    def _get_recent_historical(self, country: str, sector: str, n: int = 6) -> list:
        """Retourne les n dernières périodes d'historique réel pour le graphique."""
        df   = self._get_last_data()
        mask = df['country'] == country
        if sector:
            mask &= df['industry'] == sector
        cdf = df[mask].copy()
        if cdf.empty:
            return []

        cdf['year_month'] = cdf['date'].dt.to_period('M').astype(str)
        agg = (
            cdf.groupby('year_month')
            .agg(total=('layoff_count', 'sum'), events=('company', 'count'))
            .reset_index()
            .sort_values('year_month')
            .tail(n)
        )
        return [
            {'month': r['year_month'], 'total': int(r['total']), 'events': int(r['events'])}
            for _, r in agg.iterrows()
        ]

    # ── Méthodes utilitaires pour l'API ──────────────────────────────────────

    def get_metrics(self) -> dict:
        """Retourne les métriques de tous les modèles."""
        return self._metrics

    def get_shap(self, granularity: str = 'quarterly') -> dict:
        """Retourne le résumé SHAP pour une granularité."""
        return self._shap.get(granularity, {})

    def get_available_countries(self) -> list:
        """Retourne la liste triée des pays disponibles dans les données (sans NaN)."""
        return sorted(
            str(v) for v in self._get_last_data()['country'].dropna().unique()
        )

    def get_available_sectors(self) -> list:
        """Retourne la liste triée des secteurs disponibles dans les données (sans NaN)."""
        return sorted(
            str(v) for v in self._get_last_data()['industry'].dropna().unique()
        )

    def reload_metadata(self):
        """Force le rechargement des métriques et des SHAP (après retrain)."""
        self._load_metadata()
        self._models      = {}  # force reload des modèles au prochain appel
        self._macro_latest = None


# ── Wrapper global de compatibilite pour les tests ───────────────────────────
_DEFAULT_PREDICTOR = None

def predict(country: str, sector: str, granularity: str = 'quarterly', n_periods: int = 3) -> dict:
    """
    Fonction utilitaire autonome (correction 3 / test final) qui wrappe
    l'appel au Predictor singleton pour retourner les predictions.
    """
    global _DEFAULT_PREDICTOR
    if _DEFAULT_PREDICTOR is None:
        _DEFAULT_PREDICTOR = Predictor()
    try:
        return _DEFAULT_PREDICTOR.predict(country, sector, granularity, n_periods)
    except ValueError as e:
        return {"error": str(e)}
