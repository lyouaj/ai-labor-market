/**
 * api.js — Client HTTP pour le backend FastAPI (AI Labor Market).
 *
 * Tous les appels passent par fetchWithRetry() qui gère :
 *  - timeout configurable par requête
 *  - backoff exponentiel (1s, 2s, 4s…)
 *  - renvoi de l'erreur HTTP sous forme de message lisible
 */

// NEXT_PUBLIC_API_URL is injected at build time by vercel.json ("build.env").
// In local dev it falls back to the FastAPI dev server on port 8000.
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

// ── Retry-capable fetch with timeout ──────────────────────────────────────────
async function fetchWithRetry(url, options = {}, retries = 3, timeout = 10000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)
      const r = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timer)
      if (!r.ok) {
        const detail = await r.json().catch(() => ({}))
        throw new Error(detail?.detail || `HTTP ${r.status}: ${r.statusText}`)
      }
      return await r.json()
    } catch (err) {
      if (attempt === retries) throw err
      const delay = 1000 * Math.pow(2, attempt - 1)
      console.warn(`[api] Retry ${attempt}/${retries} for ${url} in ${delay}ms —`, err.message)
      await new Promise(res => setTimeout(res, delay))
    }
  }
}

// ── Query-string builder (ignores null / undefined / '' / 'all') ──────────────
function qs(params) {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '' && v !== 'all') p.append(k, v)
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION : DONNÉES & FILTRES
// ══════════════════════════════════════════════════════════════════════════════

/** Retourne les listes de pays et secteurs pour les dropdowns. */
export async function fetchFilters() {
  return fetchWithRetry(`${BASE}/filters`)
}

/** Retourne les KPIs globaux (avec filtres optionnels). */
export async function fetchSummary(filters = {}) {
  return fetchWithRetry(`${BASE}/summary${qs(filters)}`)
}

/** Retourne la tendance mensuelle agrégée des licenciements. */
export async function fetchMonthly(filters = {}) {
  return fetchWithRetry(`${BASE}/monthly${qs(filters)}`)
}

/** Retourne le top N pays par licenciements. */
export async function fetchByCountry(filters = {}) {
  return fetchWithRetry(`${BASE}/by-country${qs({ limit: 10, ...filters })}`)
}

/** Retourne le top N secteurs par licenciements. */
export async function fetchByIndustry(filters = {}) {
  return fetchWithRetry(`${BASE}/by-industry${qs({ limit: 10, ...filters })}`)
}

/** Retourne le sentiment des actualités (50 derniers mois par défaut). */
export async function fetchSentiment(limit = 50) {
  return fetchWithRetry(`${BASE}/sentiment?limit=${limit}`)
}

/** Retourne la liste paginée des événements de licenciements. */
export async function fetchEvents(filters = {}) {
  return fetchWithRetry(`${BASE}/events${qs({ limit: 20, ...filters })}`)
}

/** Retourne les features contextuelles d'un pays (et optionnellement secteur). */
export async function fetchCountryFeatures(country, industry = null) {
  const params = industry ? `?industry=${encodeURIComponent(industry)}` : ''
  return fetchWithRetry(
    `${BASE}/country-features/${encodeURIComponent(country)}${params}`
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION : LISTES DISPONIBLES
// ══════════════════════════════════════════════════════════════════════════════

/** Retourne la liste de tous les secteurs disponibles dans les données. */
export async function fetchSectors() {
  return fetchWithRetry(`${BASE}/sectors`)
}

/** Retourne la liste de tous les pays disponibles dans les données. */
export async function fetchCountries() {
  return fetchWithRetry(`${BASE}/countries`)
}

/** Retourne les indicateurs macro agrégés par trimestre pour overlay graphique. */
export async function fetchMacroTrend() {
  return fetchWithRetry(`${BASE}/macro-trend`)
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION : PRÉDICTION ML (XGBoost)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Lance une prédiction en cascade XGBoost.
 *
 * @param {string} country     — Nom du pays (ex. "United States")
 * @param {string|null} sector — Nom du secteur (ex. "Finance") ou null
 * @param {string} granularity — "quarterly" ou "semester"
 * @param {number} n_periods   — Nombre de périodes à prédire (1-8)
 * @returns {Promise<Object>}  — JSON structuré avec predictions, alert, top_factors…
 */
export async function fetchPredict(country, sector = null, granularity = 'quarterly', n_periods = 3) {
  const body = { country, granularity, n_periods }
  if (sector) body.sector = sector
  return fetchWithRetry(
    `${BASE}/predict`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    2,    // 2 retries (prédiction peut prendre du temps)
    20000 // 20s timeout
  )
}

/**
 * Endpoint de compatibilité (ancienne API).
 * Préférer fetchPredict() pour les nouveaux appels.
 */
export async function postForecast(country, period = 'quarterly', industry = null, n_periods = 4) {
  const body = { country, period, n_periods }
  if (industry) body.industry = industry
  return fetchWithRetry(
    `${BASE}/forecast`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    2,
    20000
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION : MÉTRIQUES & SHAP
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Retourne les métriques des modèles (MAE, MAPE, R² par granularité).
 */
export async function fetchMetrics() {
  return fetchWithRetry(`${BASE}/metrics`)
}

/**
 * Retourne le résumé SHAP pour une granularité.
 * @param {string} granularity — "quarterly" ou "semester"
 */
export async function fetchShap(granularity = 'quarterly') {
  return fetchWithRetry(`${BASE}/shap/${granularity}`)
}

/**
 * Retourne le résumé SHAP filtré pour un secteur et un pays.
 * @param {string} sector
 * @param {string} country
 * @param {string} granularity
 */
export async function fetchShapForSectorCountry(sector, country, granularity = 'quarterly') {
  return fetchWithRetry(
    `${BASE}/shap/${encodeURIComponent(sector)}/${encodeURIComponent(country)}` +
    `?granularity=${granularity}`
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION : SANTÉ & RE-ENTRAÎNEMENT
// ══════════════════════════════════════════════════════════════════════════════

/** Vérifie que l'API et les modèles sont disponibles. */
export async function fetchHealth() {
  return fetchWithRetry(`${BASE}/health`, {}, 1, 5000)
}

/**
 * Déclenche le re-entraînement complet en arrière-plan.
 * L'API retourne immédiatement avec status "accepted".
 */
export async function postRetrain() {
  return fetchWithRetry(
    `${BASE}/retrain`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    1,
    10000
  )
}

// ── Alias rétro-compatible ────────────────────────────────────────────────────
/** @deprecated Use fetchPredict() instead */
export async function postPredict(features) {
  return fetchWithRetry(
    `${BASE}/predict`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
    }
  )
}
