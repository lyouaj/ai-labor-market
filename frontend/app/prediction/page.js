'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Brain, BarChart3, TrendingUp, TrendingDown, AlertTriangle,
  Newspaper, Users, Activity, ChevronRight, Info, CalendarRange,
  ShieldCheck
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line,
  ReferenceLine, Legend
} from 'recharts'
import { fetchFilters, fetchCountryFeatures, postForecast } from '@/lib/api'

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
    format: v => (v > 0 ? '+' : '') + v.toFixed(3),
    description: 'Score moyen de sentiment des articles de presse (-1 à +1). Un sentiment négatif persistant précède souvent des vagues de licenciements.',
  },
  {
    key: 'negative_ratio',
    label: 'Ratio Négatif',
    icon: AlertTriangle,
    color: '#f59e0b',
    unit: '%',
    format: v => (v * 100).toFixed(1) + '%',
    description: 'Proportion d\'articles à tonalité négative. Plus ce ratio est élevé, plus le climat économique perçu est pessimiste.',
  },
  {
    key: 'ai_ratio',
    label: 'Part IA',
    icon: Brain,
    color: '#3b82f6',
    unit: '%',
    format: v => (v * 100).toFixed(1) + '%',
    description: 'Proportion d\'événements de licenciement liés à des entreprises d\'IA. Indicateur de la disruption technologique dans le marché.',
  },
  {
    key: 'layoffs_lag1',
    label: 'Licenciements M-1',
    icon: TrendingDown,
    color: '#ec4899',
    unit: '',
    format: v => Math.round(v).toLocaleString(),
    description: 'Nombre de licenciements du mois précédent. L\'inertie des tendances passées est un puissant prédicteur des mois suivants.',
  },
  {
    key: 'layoffs_rolling3',
    label: 'Moyenne Mobile 3M',
    icon: Activity,
    color: '#06b6d4',
    unit: '',
    format: v => Math.round(v).toLocaleString(),
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
          <span className="forecast-tooltip-val">{Number(e.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────── */
export default function PredictionPage() {
  const [countries, setCountries] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [period, setPeriod] = useState('quarterly')
  const [context, setContext] = useState(null)
  const [features, setFeatures] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingCountry, setLoadingCountry] = useState(false)
  const [activeIndicator, setActiveIndicator] = useState(null)

  useEffect(() => {
    fetchFilters().then(d => setCountries(d.countries || [])).catch(console.error)
  }, [])

  const handleCountryChange = async (e) => {
    const country = e.target.value
    setSelectedCountry(country)
    setForecast(null); setFeatures(null); setContext(null)
    if (!country) return
    setLoadingCountry(true)
    try {
      const data = await fetchCountryFeatures(country)
      setFeatures(data.features); setContext(data.context)
    } catch (err) { console.error(err) }
    finally { setLoadingCountry(false) }
  }

  const handleForecast = async () => {
    if (!features || !selectedCountry) return
    setLoading(true)
    try {
      const result = await postForecast(selectedCountry, period)
      setForecast(result)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  /* ── Chart Data ──────────────────────────────────── */
  const chartData = useMemo(() => {
    if (!forecast) return []
    const historical = (forecast.historical || []).map(h => ({
      name: h.month,
      Historique: h.total,
      type: 'historical',
    }))
    const periodLabels = period === 'quarterly'
      ? ['M+1', 'M+2', 'M+3']
      : ['M+1', 'M+2', 'M+3', 'M+4', 'M+5', 'M+6']

    const lastHistorical = historical.length > 0 ? historical[historical.length - 1] : null
    const bridge = lastHistorical ? [{
      name: lastHistorical.name,
      Historique: lastHistorical.Historique,
      Prévision: lastHistorical.Historique,
      Min: lastHistorical.Historique,
      Max: lastHistorical.Historique,
      type: 'bridge',
    }] : []

    const predictions = forecast.predictions.map((p, i) => ({
      name: periodLabels[i] || `M+${i + 1}`,
      Prévision: p.predicted_layoffs,
      Min: p.lower_bound,
      Max: p.upper_bound,
      type: 'forecast',
    }))
    return [...historical, ...bridge, ...predictions]
  }, [forecast, period])

  /* ── Feature importance ─────────────────────────── */
  const topFeatures = useMemo(() => {
    if (!forecast?.feature_importance) return []
    return Object.entries(forecast.feature_importance)
      .sort(([, a], [, b]) => b - a).slice(0, 8)
  }, [forecast])
  const maxImp = topFeatures.length > 0 ? topFeatures[0][1] : 1

  /* ── Summary stats ──────────────────────────────── */
  const summaryStats = useMemo(() => {
    if (!forecast?.predictions?.length) return null
    const preds = forecast.predictions
    const total = preds.reduce((s, p) => s + p.predicted_layoffs, 0)
    const avg = Math.round(total / preds.length)
    const trend = preds.length >= 2
      ? preds[preds.length - 1].predicted_layoffs - preds[0].predicted_layoffs
      : 0
    return { total, avg, trend, count: preds.length }
  }, [forecast])

  /* ── Indicator values ──────────────────────────── */
  const indicators = useMemo(() => {
    if (!forecast?.base_indicators) return []
    return INDICATOR_META.map(meta => ({
      ...meta,
      value: forecast.base_indicators[meta.key] ?? 0,
    }))
  }, [forecast])

  return (
    <>
      <div className="page-head">
        <h1>Prévision des Licenciements</h1>
        <p>Modèle prédictif multi-périodes — sélectionnez un pays et un horizon</p>
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

            {/* Period Select */}
            <label className="forecast-label">Période de prédiction</label>
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
                <div className="context-row"><span className="context-label">Pays</span><span className="context-value">{context.country}</span></div>
                <div className="context-row"><span className="context-label">Total Licenciements</span><span className="context-value">{context.country_total_layoffs.toLocaleString()}</span></div>
                <div className="context-row"><span className="context-label">Événements</span><span className="context-value">{context.country_total_events}</span></div>
                <div className="context-row"><span className="context-label">Événements IA</span><span className="context-value">{context.country_ai_events}</span></div>
                <div className="context-row"><span className="context-label">Industrie #1</span><span className="context-value">{context.country_top_industry}</span></div>
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
              <p>Le modèle utilise un algorithme de <strong>Gradient Boosting / Random Forest</strong> entraîné sur des données historiques de licenciements, indicateurs économiques et analyse de sentiment.</p>
              <div className="forecast-info-tags">
                <span className="forecast-tag"><ShieldCheck size={12} /> Cross-validation</span>
                <span className="forecast-tag"><Activity size={12} /> Time-series split</span>
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
              <p>Sélectionnez un pays et une période, puis cliquez sur <strong>Générer la Prévision</strong></p>
              <div className="forecast-empty-steps">
                <div className="forecast-step"><span className="forecast-step-num">1</span>Choisir un pays</div>
                <ChevronRight size={14} className="forecast-step-arrow" />
                <div className="forecast-step"><span className="forecast-step-num">2</span>Sélectionner la période</div>
                <ChevronRight size={14} className="forecast-step-arrow" />
                <div className="forecast-step"><span className="forecast-step-num">3</span>Générer</div>
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
                    <div className="forecast-kpi-value">{summaryStats.total.toLocaleString()}</div>
                    <div className="forecast-kpi-sub">
                      {period === 'quarterly' ? '3 mois' : '6 mois'}
                    </div>
                  </div>
                  <div className="forecast-kpi">
                    <div className="forecast-kpi-label">Moyenne / Mois</div>
                    <div className="forecast-kpi-value">{summaryStats.avg.toLocaleString()}</div>
                    <div className="forecast-kpi-sub">licenciements</div>
                  </div>
                  <div className="forecast-kpi">
                    <div className="forecast-kpi-label">Tendance</div>
                    <div className={`forecast-kpi-value ${summaryStats.trend > 0 ? 'trend-up' : 'trend-down'}`}>
                      {summaryStats.trend > 0 ? '+' : ''}{summaryStats.trend.toLocaleString()}
                    </div>
                    <div className="forecast-kpi-sub">
                      {summaryStats.trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {summaryStats.trend > 0 ? ' hausse' : ' baisse'}
                    </div>
                  </div>
                  <div className="forecast-kpi">
                    <div className="forecast-kpi-label">Modèle</div>
                    <div className="forecast-kpi-value model-name">{forecast.model_used}</div>
                    <div className="forecast-kpi-sub">algorithme</div>
                  </div>
                </div>
              )}

              {/* Main Forecast Chart */}
              <div className="forecast-chart-panel">
                <div className="panel-head">
                  <span className="panel-title">Historique & Prévisions</span>
                  <span className="panel-badge">
                    {period === 'quarterly' ? 'Trimestrielle' : 'Semestrielle'}
                  </span>
                </div>
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                      <defs>
                        <linearGradient id="gHist" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0a0a0a" stopOpacity={0.08} />
                          <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.06} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTooltip />} />
                      {/* Confidence band */}
                      <Area type="monotone" dataKey="Max" stroke="none" fill="url(#gBand)" fillOpacity={1} name="Max" />
                      <Area type="monotone" dataKey="Min" stroke="none" fill="#ffffff" fillOpacity={0.8} name="Min" />
                      {/* Historical */}
                      <Area type="monotone" dataKey="Historique" stroke="#0a0a0a" fill="url(#gHist)"
                        strokeWidth={2} dot={false} name="Historique" connectNulls={false} />
                      {/* Forecast */}
                      <Area type="monotone" dataKey="Prévision" stroke="#3b82f6" fill="url(#gForecast)"
                        strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                        name="Prévision" connectNulls={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-legend" style={{ marginTop: 12 }}>
                  <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: '#0a0a0a' }} />Historique</span>
                  <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: '#3b82f6' }} />Prévision</span>
                  <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: 'rgba(59,130,246,0.15)' }} />Intervalle de confiance</span>
                </div>
              </div>

              {/* Period Breakdown Bars */}
              <div className="forecast-chart-panel">
                <div className="panel-head">
                  <span className="panel-title">Détail par Période</span>
                  <span className="panel-badge">{forecast.predictions.length} mois</span>
                </div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecast.predictions.map((p, i) => ({
                      name: period === 'quarterly'
                        ? ['Mois 1', 'Mois 2', 'Mois 3'][i]
                        : `Mois ${i + 1}`,
                      Prévu: p.predicted_layoffs,
                      Min: p.lower_bound,
                      Max: p.upper_bound,
                    }))} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                      <CartesianGrid stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="Prévu" radius={[6, 6, 0, 0]} name="Prévu">
                        {forecast.predictions.map((_, i) => (
                          <Cell key={i} fill={i === forecast.predictions.length - 1 ? '#3b82f6' : '#0a0a0a'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Indicators Explanation */}
              <div className="forecast-chart-panel">
                <div className="panel-head">
                  <span className="panel-title">Indicateurs Utilisés</span>
                  <span className="panel-badge">6 indicateurs</span>
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
                      : `${ind.value}${ind.unit}`
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
                              width: `${(value / maxImp) * 100}%`,
                              background: i === 0 ? '#3b82f6' : i < 3 ? '#0a0a0a' : '#a3a3a3',
                            }}
                          />
                        </div>
                        <span className="importance-val">{(value * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
