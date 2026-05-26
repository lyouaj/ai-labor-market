'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Brain, BarChart3, TrendingUp, TrendingDown, AlertTriangle,
  Newspaper, Users, Activity, ChevronRight, Info, CalendarRange,
  ShieldCheck, Factory, Maximize2, X
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Line, ComposedChart
} from 'recharts'
import { fetchFilters, fetchCountryFeatures, postForecast, fetchMacroTrend } from '@/lib/api'

/* ── Safe number helper ──────────────────────────────── */
function safe(v, fallback = 0) {
  if (v === null || v === undefined) return fallback
  const n = Number(v)
  return isNaN(n) || !isFinite(n) ? fallback : n
}

/* ── Indicator meta for explanation cards ────────────── */
const INDICATOR_META = [
  {
    key: 'unemployment_rate',
    label: 'Taux de Chômage',
    icon: Users,
    color: '#ef4444',
    unit: '%',
    description: 'Le taux de chômage général reflète la santé du marché du travail. Un taux élevé signale une économie fragile, augmentant la probabilité de licenciements.',
  },
  {
    key: 'avg_sentiment',
    label: 'Sentiment Médiatique',
    icon: Newspaper,
    color: '#8b5cf6',
    unit: '',
    format: v => { const n = safe(v); return (n > 0 ? '+' : '') + n.toFixed(3) },
    description: 'Score moyen de sentiment des articles de presse (-1 à +1). Un sentiment négatif persistant précède souvent des vagues de licenciements.',
  },
  {
    key: 'negative_ratio',
    label: 'Ratio Négatif',
    icon: AlertTriangle,
    color: '#f59e0b',
    unit: '%',
    format: v => (safe(v) * 100).toFixed(1) + '%',
    description: 'Proportion d\'articles à tonalité négative. Plus ce ratio est élevé, plus le climat économique perçu est pessimiste.',
  },
  {
    key: 'ai_ratio',
    label: 'Part IA',
    icon: Brain,
    color: '#3b82f6',
    unit: '%',
    format: v => (safe(v) * 100).toFixed(1) + '%',
    description: 'Proportion d\'événements de licenciement liés à des entreprises d\'IA. Indicateur de la disruption technologique dans le marché.',
  },
  {
    key: 'layoffs_lag1',
    label: 'Licenciements M-1',
    icon: TrendingDown,
    color: '#ec4899',
    unit: '',
    format: v => Math.round(safe(v)).toLocaleString(),
    description: 'Nombre de licenciements du mois précédent. L\'inertie des tendances passées est un puissant prédicteur des mois suivants.',
  },
  {
    key: 'layoffs_rolling3',
    label: 'Moyenne Mobile 3M',
    icon: Activity,
    color: '#06b6d4',
    unit: '',
    format: v => Math.round(safe(v)).toLocaleString(),
    description: 'Moyenne glissante sur 3 mois des licenciements. Lisse les variations et révèle la tendance de fond du marché.',
  },
]

/* ── Custom Tooltip ──────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="forecast-tooltip">
      <div className="forecast-tooltip-label">{label}</div>
      {payload.map((e, i) => (
        <div key={i} className="forecast-tooltip-row">
          <span className="forecast-tooltip-dot" style={{ background: e.color || e.stroke }} />
          <span className="forecast-tooltip-name">{e.name}</span>
          <span className="forecast-tooltip-val">{safe(e.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────── */
export default function PredictionPage() {
  const [countries, setCountries] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [industries, setIndustries] = useState([])
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [period, setPeriod] = useState('quarterly')
  const [context, setContext] = useState(null)
  const [features, setFeatures] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingCountry, setLoadingCountry] = useState(false)
  const [activeIndicator, setActiveIndicator] = useState(null)
  const [chartExpanded, setChartExpanded] = useState(false)
  const [macroTrend, setMacroTrend] = useState([])
  const [overlays, setOverlays] = useState({
    unemployment_rate: false,
    jolts_job_openings_k: false,
    claims_4w_avg: false,
  })

  const OVERLAY_META = {
    unemployment_rate:    { label: 'Taux de Chômage (%)', color: '#ef4444' },
    jolts_job_openings_k: { label: 'Offres JOLTS (k)', color: '#f59e0b' },
    claims_4w_avg:        { label: 'Allocations Chômage (k)', color: '#8b5cf6' },
  }

  useEffect(() => {
    fetchFilters().then(d => {
      setCountries(d.countries || [])
    }).catch(console.error)
  }, [])

  const handleCountryChange = async (e) => {
    const country = e.target.value
    setSelectedCountry(country)
    setSelectedIndustry('')
    setForecast(null); setFeatures(null); setContext(null)
    setIndustries([])
    if (!country) return
    setLoadingCountry(true)
    try {
      const data = await fetchCountryFeatures(country)
      setFeatures(data.features); setContext(data.context)
      setIndustries(data.context?.country_industries || [])
    } catch (err) { console.error(err) }
    finally { setLoadingCountry(false) }
  }

  const handleIndustryChange = async (e) => {
    const industry = e.target.value
    setSelectedIndustry(industry)
    setForecast(null)
    if (!selectedCountry) return
    setLoadingCountry(true)
    try {
      const data = await fetchCountryFeatures(selectedCountry, industry || null)
      setFeatures(data.features); setContext(data.context)
    } catch (err) { console.error(err) }
    finally { setLoadingCountry(false) }
  }

  const handleForecast = async () => {
    if (!features || !selectedCountry) return
    setLoading(true)
    try {
      const [result, macro] = await Promise.all([
        postForecast(selectedCountry, period, selectedIndustry || null, 4),
        fetchMacroTrend().catch(() => []),
      ])
      setForecast(result)
      setMacroTrend(macro || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const toggleOverlay = (key) => setOverlays(prev => ({ ...prev, [key]: !prev[key] }))
  const anyOverlay = Object.values(overlays).some(Boolean)

  /* ── Chart Data ──────────────────────────────────── */
  const chartData = useMemo(() => {
    if (!forecast?.predictions?.length) return []

    // Convert monthly historical data to quarterly aggregation
    const rawHist = forecast.historical || []
    const quarterMap = {}
    rawHist.forEach(h => {
      if (!h.month) return
      const [y, m] = h.month.split('-').map(Number)
      const q = Math.ceil(m / 3)
      const key = `Q${q}-${y}`
      if (!quarterMap[key]) quarterMap[key] = { total: 0, label: key }
      quarterMap[key].total += safe(h.total)
    })
    const historical = Object.values(quarterMap)
      .sort((a, b) => {
        const [qa, ya] = [a.label.charAt(1), a.label.split('-')[1]]
        const [qb, yb] = [b.label.charAt(1), b.label.split('-')[1]]
        return ya !== yb ? ya - yb : qa - qb
      })
      .map(q => ({ name: q.label, Historique: q.total, type: 'historical' }))

    const predictions = forecast.predictions

    // Bridge point to connect historical and forecast lines
    const lastHistorical = historical.length > 0 ? historical[historical.length - 1] : null
    const bridge = lastHistorical ? [{
      name: lastHistorical.name,
      Historique: lastHistorical.Historique,
      Prévision: lastHistorical.Historique,
      Min: lastHistorical.Historique,
      Max: lastHistorical.Historique,
      type: 'bridge',
    }] : []

    const forecastPoints = predictions.map((p, i) => ({
      name: p.period || `P+${i + 1}`,
      Prévision: safe(p.predicted_layoffs),
      Min: safe(p.lower_bound),
      Max: safe(p.upper_bound),
      type: 'forecast',
    }))
    return [...historical, ...bridge, ...forecastPoints]
  }, [forecast])

  /* ── Merge macro trend data into chart ───────────── */
  const chartDataWithMacro = useMemo(() => {
    if (!chartData.length) return chartData
    const macroMap = {}
    macroTrend.forEach(m => { macroMap[m.period] = m })
    return chartData.map(point => {
      const macro = macroMap[point.name]
      if (!macro) return point
      return {
        ...point,
        unemployment_rate: macro.unemployment_rate,
        jolts_job_openings_k: macro.jolts_job_openings_k,
        claims_4w_avg: macro.claims_4w_avg,
      }
    })
  }, [chartData, macroTrend])

  /* ── Feature importance ─────────────────────────── */
  const topFeatures = useMemo(() => {
    if (!forecast?.feature_importance) return []
    return Object.entries(forecast.feature_importance)
      .map(([k, v]) => [k, safe(v)])
      .sort(([, a], [, b]) => b - a).slice(0, 8)
  }, [forecast])
  const maxImp = topFeatures.length > 0 ? topFeatures[0][1] : 1

  /* ── Summary stats ──────────────────────────────── */
  const summaryStats = useMemo(() => {
    if (!forecast?.predictions?.length) return null
    const preds = forecast.predictions
    const total = preds.reduce((s, p) => s + safe(p.predicted_layoffs), 0)
    const avg = Math.round(total / preds.length)
    const trend = preds.length >= 2
      ? safe(preds[preds.length - 1].predicted_layoffs) - safe(preds[0].predicted_layoffs)
      : 0
    return { total: safe(total), avg: safe(avg), trend: safe(trend), count: preds.length }
  }, [forecast])

  /* ── Indicator values ──────────────────────────── */
  const indicators = useMemo(() => {
    if (!forecast?.base_indicators) return []
    return INDICATOR_META.map(meta => ({
      ...meta,
      value: safe(forecast.base_indicators[meta.key]),
    }))
  }, [forecast])

  /* ── Reusable chart renderer ─────────────────────── */
  const renderMainChart = (isFullscreen) => {
    const chartHeight = isFullscreen ? 'calc(100vh - 180px)' : 320

    const overlayCheckboxes = (
      <div className="chart-overlays-bar">
        <span className="chart-overlays-label">Indicateurs :</span>
        {Object.entries(OVERLAY_META).map(([key, meta]) => (
          <label key={key} className={`chart-overlay-check ${overlays[key] ? 'active' : ''}`}>
            <input type="checkbox" checked={overlays[key]} onChange={() => toggleOverlay(key)} />
            <span className="chart-overlay-dot" style={{ background: meta.color }} />
            {meta.label}
          </label>
        ))}
      </div>
    )

    return (
      <div className="forecast-chart-panel">
        <div className="panel-head">
          <span className="panel-title">Historique & Prévisions</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="panel-badge">
              {period === 'quarterly' ? 'Trimestrielle' : 'Semestrielle'}
            </span>
            <button
              className="chart-expand-btn"
              onClick={() => setChartExpanded(!chartExpanded)}
              title={chartExpanded ? 'Réduire' : 'Agrandir'}
            >
              {chartExpanded ? <X size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
        {!isFullscreen && overlayCheckboxes}
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartDataWithMacro} margin={{ top: 10, right: anyOverlay ? 60 : 20, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id={`gHist${isFullscreen?'F':''}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0a0a0a" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`gForecast${isFullscreen?'F':''}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`gBand${isFullscreen?'F':''}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" stroke="#a3a3a3" fontSize={isFullscreen ? 13 : 11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="#a3a3a3" fontSize={isFullscreen ? 13 : 11} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              {anyOverlay && (
                <YAxis yAxisId="right" orientation="right" stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} />
              )}
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="left" type="monotone" dataKey="Max" stroke="none" fill={`url(#gBand${isFullscreen?'F':''})`} fillOpacity={1} name="Max" />
              <Area yAxisId="left" type="monotone" dataKey="Min" stroke="none" fill="#ffffff" fillOpacity={0.8} name="Min" />
              <Area yAxisId="left" type="monotone" dataKey="Historique" stroke="#0a0a0a" fill={`url(#gHist${isFullscreen?'F':''})`}
                strokeWidth={2} dot={false} name="Historique" connectNulls={false} />
              <Area yAxisId="left" type="monotone" dataKey="Prévision" stroke="#3b82f6" fill={`url(#gForecast${isFullscreen?'F':''})`}
                strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                name="Prévision" connectNulls={false} />
              {overlays.unemployment_rate && (
                <Line yAxisId="right" type="monotone" dataKey="unemployment_rate" stroke="#ef4444"
                  strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} name="Chômage (%)" connectNulls />
              )}
              {overlays.jolts_job_openings_k && (
                <Line yAxisId="right" type="monotone" dataKey="jolts_job_openings_k" stroke="#f59e0b"
                  strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} name="JOLTS (k)" connectNulls />
              )}
              {overlays.claims_4w_avg && (
                <Line yAxisId="right" type="monotone" dataKey="claims_4w_avg" stroke="#8b5cf6"
                  strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name="Allocations (k)" connectNulls />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-legend" style={{ marginTop: 12 }}>
          <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: '#0a0a0a' }} />Historique</span>
          <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: '#3b82f6' }} />Prévision</span>
          <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: 'rgba(59,130,246,0.15)' }} />IC 80%</span>
          {overlays.unemployment_rate && <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: '#ef4444' }} />Chômage</span>}
          {overlays.jolts_job_openings_k && <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: '#f59e0b' }} />JOLTS</span>}
          {overlays.claims_4w_avg && <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: '#8b5cf6' }} />Allocations</span>}
        </div>
        {isFullscreen && overlayCheckboxes}
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <h1>Prévision des Licenciements</h1>
        <p>Modèle prédictif multi-périodes — sélectionnez un pays, un secteur et un horizon</p>
      </div>

      <div className="forecast-layout">
        {/* ── LEFT: Controls ────────────────────────── */}
        <div className="forecast-controls">
          <div className="forecast-card">
            <div className="forecast-card-header">
              <div className="forecast-card-icon"><CalendarRange size={16} /></div>
              <div>
                <h3>Configuration</h3>
                <p>Paramètres de la prévision</p>
              </div>
            </div>

            {/* Country Select */}
            <label className="forecast-label">Pays / Région</label>
            <div className="select-wrapper" id="country-select">
              <select value={selectedCountry} onChange={handleCountryChange}>
                <option value="">Choisir un pays…</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Industry / Sector Select */}
            <label className="forecast-label" style={{ marginTop: 12 }}>
              <Factory size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              Secteur / Industrie
            </label>
            <div className="select-wrapper" id="industry-select">
              <select
                value={selectedIndustry}
                onChange={handleIndustryChange}
                disabled={!selectedCountry || industries.length === 0}
              >
                <option value="">Tous les secteurs</option>
                {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>

            {/* Period Select */}
            <label className="forecast-label" style={{ marginTop: 12 }}>Période de prédiction</label>
            <div className="period-toggle" id="period-select">
              <button
                className={`period-btn ${period === 'quarterly' ? 'active' : ''}`}
                onClick={() => setPeriod('quarterly')}
              >
                <CalendarRange size={14} />
                Trimestrielle
              </button>
              <button
                className={`period-btn ${period === 'semiannual' ? 'active' : ''}`}
                onClick={() => setPeriod('semiannual')}
              >
                <CalendarRange size={14} />
                Semestrielle
              </button>
            </div>

            {loadingCountry && (
              <div className="forecast-loading-inline">
                <div className="spinner" /> Chargement…
              </div>
            )}

            {/* Country Context */}
            {context && (
              <div className="country-context fade-in">
                <div className="context-row"><span className="context-label">Pays</span><span className="context-value">{context.country || '—'}</span></div>
                {context.industry && (
                  <div className="context-row"><span className="context-label">Secteur</span><span className="context-value highlight">{context.industry}</span></div>
                )}
                <div className="context-row"><span className="context-label">Total Licenciements</span><span className="context-value">{safe(context.country_total_layoffs).toLocaleString()}</span></div>
                <div className="context-row"><span className="context-label">Événements</span><span className="context-value">{safe(context.country_total_events).toLocaleString()}</span></div>
                <div className="context-row"><span className="context-label">Événements IA</span><span className="context-value">{safe(context.country_ai_events).toLocaleString()}</span></div>
                <div className="context-row"><span className="context-label">Industrie #1</span><span className="context-value">{context.country_top_industry || '—'}</span></div>
                {context.country_unemployment != null && (
                  <div className="context-row"><span className="context-label">Chômage Pays</span><span className="context-value">{safe(context.country_unemployment)}%</span></div>
                )}
              </div>
            )}

            <button
              className="predict-btn"
              onClick={handleForecast}
              disabled={!features || loading}
              id="forecast-btn"
            >
              {loading
                ? <><div className="spinner-white" /> Analyse en cours…</>
                : <><Brain size={15} /> Générer la Prévision</>
              }
            </button>
          </div>

          {/* Period Info Card */}
          <div className="forecast-card forecast-info-card">
            <div className="forecast-card-header">
              <div className="forecast-card-icon info"><Info size={16} /></div>
              <div>
                <h3>À propos du modèle</h3>
                <p>Machine Learning prédictif</p>
              </div>
            </div>
            <div className="forecast-info-body">
              <p>Le modèle utilise un algorithme <strong>XGBoost (Gradient Boosting)</strong> entraîné sur des données historiques de licenciements, indicateurs économiques et features temporelles (lags, rolling, tendances).</p>
              <div className="forecast-info-tags">
                <span className="forecast-tag"><ShieldCheck size={12} /> Temporal split</span>
                <span className="forecast-tag"><Activity size={12} /> Cascade prediction</span>
                <span className="forecast-tag"><Brain size={12} /> 19 features</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Results ───────────────────────── */}
        <div className="forecast-results">
          {!forecast && !loading && (
            <div className="forecast-empty-state">
              <div className="forecast-empty-icon">
                <BarChart3 size={48} strokeWidth={1.2} />
              </div>
              <h4>Aucune prévision générée</h4>
              <p>Sélectionnez un pays, un secteur et une période, puis cliquez sur <strong>Générer la Prévision</strong></p>
              <div className="forecast-empty-steps">
                <div className="forecast-step"><span className="forecast-step-num">1</span>Choisir un pays</div>
                <ChevronRight size={14} className="forecast-step-arrow" />
                <div className="forecast-step"><span className="forecast-step-num">2</span>Choisir un secteur</div>
                <ChevronRight size={14} className="forecast-step-arrow" />
                <div className="forecast-step"><span className="forecast-step-num">3</span>Sélectionner la période</div>
                <ChevronRight size={14} className="forecast-step-arrow" />
                <div className="forecast-step"><span className="forecast-step-num">4</span>Générer</div>
              </div>
            </div>
          )}

          {loading && (
            <div className="forecast-loading-state">
              <div className="forecast-pulse-ring" />
              <p>Analyse prédictive en cours…</p>
              <span>Le modèle calcule les tendances futures</span>
            </div>
          )}

          {forecast && !loading && (
            <div className="forecast-display fade-in">
              {/* Summary KPIs */}
              {summaryStats && (
                <div className="forecast-kpi-row">
                  <div className="forecast-kpi">
                    <div className="forecast-kpi-label">Total Prévu</div>
                    <div className="forecast-kpi-value">{safe(summaryStats.total).toLocaleString()}</div>
                    <div className="forecast-kpi-sub">
                      {forecast.predictions?.length || 0} périodes
                    </div>
                  </div>
                  <div className="forecast-kpi">
                    <div className="forecast-kpi-label">Moyenne / Période</div>
                    <div className="forecast-kpi-value">{safe(summaryStats.avg).toLocaleString()}</div>
                    <div className="forecast-kpi-sub">licenciements</div>
                  </div>
                  <div className="forecast-kpi">
                    <div className="forecast-kpi-label">Tendance</div>
                    <div className={`forecast-kpi-value ${summaryStats.trend > 0 ? 'trend-up' : 'trend-down'}`}>
                      {summaryStats.trend > 0 ? '+' : ''}{safe(summaryStats.trend).toLocaleString()}
                    </div>
                    <div className="forecast-kpi-sub">
                      {summaryStats.trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {summaryStats.trend > 0 ? ' hausse' : ' baisse'}
                    </div>
                  </div>
                  <div className="forecast-kpi">
                    <div className="forecast-kpi-label">Modèle</div>
                    <div className="forecast-kpi-value model-name">{forecast.model_used || 'XGBoost'}</div>
                    <div className="forecast-kpi-sub">algorithme</div>
                  </div>
                </div>
              )}

              {/* Main Forecast Chart */}
              {renderMainChart(false)}

              {/* Period Breakdown Bars */}
              {forecast.predictions?.length > 0 && (
                <div className="forecast-chart-panel">
                  <div className="panel-head">
                    <span className="panel-title">Détail par Période</span>
                    <span className="panel-badge">{forecast.predictions.length} période{forecast.predictions.length > 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={forecast.predictions.map((p, i) => ({
                        name: p.period || `P+${i + 1}`,
                        Prévu: safe(p.predicted_layoffs),
                        Min: safe(p.lower_bound),
                        Max: safe(p.upper_bound),
                      }))} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                        <CartesianGrid stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false}
                          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="Prévu" radius={[6, 6, 0, 0]} name="Prévu">
                          {forecast.predictions.map((_, i) => (
                            <Cell key={i} fill="#3b82f6" fillOpacity={i === 0 ? 0.6 : 0.5 + (i / forecast.predictions.length) * 0.5} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Indicators Explanation */}
              {indicators.length > 0 && (
                <div className="forecast-chart-panel">
                  <div className="panel-head">
                    <span className="panel-title">Indicateurs Utilisés</span>
                    <span className="panel-badge">{indicators.length} indicateurs</span>
                  </div>
                  <p className="forecast-indicators-desc">
                    Ces indicateurs économiques et médiatiques alimentent le modèle de prédiction.
                    Cliquez sur un indicateur pour en savoir plus.
                  </p>
                  <div className="forecast-indicators-grid">
                    {indicators.map((ind) => {
                      const Icon = ind.icon
                      const isActive = activeIndicator === ind.key
                      const displayVal = ind.format
                        ? ind.format(ind.value)
                        : `${safe(ind.value)}${ind.unit}`
                      return (
                        <div
                          key={ind.key}
                          className={`forecast-indicator-card ${isActive ? 'active' : ''}`}
                          onClick={() => setActiveIndicator(isActive ? null : ind.key)}
                          id={`indicator-${ind.key}`}
                        >
                          <div className="forecast-indicator-top">
                            <div className="forecast-indicator-icon" style={{ background: ind.color + '12', color: ind.color }}>
                              <Icon size={16} />
                            </div>
                            <div className="forecast-indicator-value" style={{ color: ind.color }}>
                              {displayVal}
                            </div>
                          </div>
                          <div className="forecast-indicator-label">{ind.label}</div>
                          {isActive && (
                            <div className="forecast-indicator-desc fade-in">
                              {ind.description}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Feature Importance */}
              {topFeatures.length > 0 && (
                <div className="forecast-chart-panel">
                  <div className="panel-head">
                    <span className="panel-title">Importance des Variables</span>
                    <span className="panel-badge">Top 8</span>
                  </div>
                  <div className="importance-list">
                    {topFeatures.map(([name, value], i) => (
                      <div key={name} className="importance-item" style={{ animationDelay: `${i * 50}ms` }}>
                        <span className="importance-label">{name.replace(/_/g, ' ')}</span>
                        <div className="importance-bar-bg">
                          <div
                            className="importance-bar"
                            style={{
                              width: `${maxImp > 0 ? (value / maxImp) * 100 : 0}%`,
                              background: i === 0 ? '#3b82f6' : i < 3 ? '#0a0a0a' : '#a3a3a3',
                            }}
                          />
                        </div>
                        <span className="importance-val">{(safe(value) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alert / Top Factors */}
              {(forecast.alert || forecast.top_factors?.length > 0) && (
                <div className="forecast-chart-panel">
                  <div className="panel-head">
                    <span className="panel-title">Analyse & Alertes</span>
                  </div>
                  {forecast.alert && (
                    <div className={`forecast-alert ${forecast.alert.includes('ÉLEVÉ') ? 'alert-high' : forecast.alert.includes('POSITIF') ? 'alert-positive' : 'alert-moderate'}`}>
                      <AlertTriangle size={16} />
                      <span>{forecast.alert}</span>
                    </div>
                  )}
                  {forecast.top_factors?.length > 0 && (
                    <ul className="forecast-factors-list">
                      {forecast.top_factors.map((f, i) => (
                        <li key={i} className="forecast-factor-item">
                          <ChevronRight size={14} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Fullscreen Overlay ──────────────────────── */}
      {chartExpanded && (
        <div className="chart-fullscreen-overlay">
          <div className="chart-fullscreen-inner">
            {renderMainChart(true)}
          </div>
        </div>
      )}
    </>
  )
}
