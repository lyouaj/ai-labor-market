'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Brain, BarChart3, TrendingUp, TrendingDown, AlertTriangle,
  Newspaper, Users, Activity, ChevronRight, Info, CalendarRange,
  ShieldCheck, Factory, Maximize2, X, ZoomIn, ChevronDown,
  BarChart2
} from 'lucide-react'
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Line, ComposedChart
} from 'recharts'
import { fetchFilters, fetchCountryFeatures, postForecast, fetchMacroTrend } from '@/lib/api'

/* ─── Safe number ──────────────────────────────────── */
function safe(v, fb = 0) {
  if (v == null) return fb
  const n = Number(v)
  return isNaN(n) || !isFinite(n) ? fb : n
}

/* ─── Format large numbers ─────────────────────────── */
function fmt(v) {
  const n = safe(v)
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toFixed(0)
}

/* ─── Indicator meta ───────────────────────────────── */
const INDICATOR_META = [
  {
    key: 'unemployment_rate',
    label: 'Taux de Chômage',
    icon: Users,
    color: '#ef4444',
    unit: '%',
    description: 'Le taux de chômage reflète la santé globale du marché du travail.',
    format: v => `${safe(v).toFixed(1)}%`,
  },
  {
    key: 'avg_sentiment',
    label: 'Sentiment Médiatique',
    icon: Newspaper,
    color: '#8b5cf6',
    unit: '',
    description: 'Score moyen du sentiment des articles de presse (-1 à +1).',
    format: v => { const n = safe(v); return (n > 0 ? '+' : '') + n.toFixed(3) },
  },
  {
    key: 'negative_ratio',
    label: 'Ratio Négatif',
    icon: AlertTriangle,
    color: '#f59e0b',
    unit: '%',
    description: 'Proportion d\'articles à tonalité négative dans les médias.',
    format: v => (safe(v) * 100).toFixed(1) + '%',
  },
  {
    key: 'ai_ratio',
    label: 'Part IA',
    icon: Brain,
    color: '#3b82f6',
    unit: '%',
    description: 'Proportion d\'événements liés à des entreprises d\'IA.',
    format: v => (safe(v) * 100).toFixed(1) + '%',
  },
  {
    key: 'layoffs_lag1',
    label: 'Licenciements M-1',
    icon: TrendingDown,
    color: '#ec4899',
    unit: '',
    description: 'Nombre de licenciements du mois précédent.',
    format: v => Math.round(safe(v)).toLocaleString(),
  },
  {
    key: 'layoffs_rolling3',
    label: 'Moyenne Mobile 3M',
    icon: Activity,
    color: '#06b6d4',
    unit: '',
    description: 'Moyenne glissante sur 3 mois des licenciements.',
    format: v => Math.round(safe(v)).toLocaleString(),
  },
]

/* ─── Tooltip ──────────────────────────────────────── */
const HIDDEN_KEYS = new Set(['bandBottom', 'bandWidth'])

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const rows = payload.filter(e => !HIDDEN_KEYS.has(e.dataKey) && e.value != null)
  if (!rows.length) return null
  return (
    <div className="fc-tooltip">
      <div className="fc-tooltip-label">{label}</div>
      {rows.map((e, i) => (
        <div key={i} className="fc-tooltip-row">
          <span className="fc-tooltip-dot" style={{ background: e.color || e.stroke }} />
          <span className="fc-tooltip-name">{e.name}</span>
          <span className="fc-tooltip-val">{safe(e.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Indicator Chart Modal ────────────────────────── */
function IndicatorModal({ indicator, forecastData, onClose }) {
  if (!indicator) return null

  // Build sparkline from forecast predictions — show indicator value as a horizontal reference
  // and overlay forecast trend
  const val = safe(indicator.value)
  const chartPoints = forecastData.map((p, i) => ({
    name: p.name,
    Prévision: p.Prévision,
    Référence: val,
  }))

  const Icon = indicator.icon
  const displayVal = indicator.format ? indicator.format(val) : `${val}${indicator.unit || ''}`

  return (
    <div className="fc-modal-overlay" onClick={onClose}>
      <div className="fc-modal" onClick={e => e.stopPropagation()}>
        <div className="fc-modal-header">
          <div className="fc-modal-icon" style={{ background: indicator.color + '18', color: indicator.color }}>
            <Icon size={22} />
          </div>
          <div className="fc-modal-title-block">
            <h2 className="fc-modal-title">{indicator.label}</h2>
            <p className="fc-modal-desc">{indicator.description}</p>
          </div>
          <button className="fc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="fc-modal-kpi-row">
          <div className="fc-modal-kpi">
            <div className="fc-modal-kpi-label">Valeur Actuelle</div>
            <div className="fc-modal-kpi-value" style={{ color: indicator.color }}>{displayVal}</div>
          </div>
          <div className="fc-modal-kpi">
            <div className="fc-modal-kpi-label">Périodes prévues</div>
            <div className="fc-modal-kpi-value">{forecastData.length}</div>
          </div>
          <div className="fc-modal-kpi">
            <div className="fc-modal-kpi-label">Tendance Prévision</div>
            <div className="fc-modal-kpi-value" style={{ color: forecastData.length >= 2 && forecastData[forecastData.length-1]?.Prévision > forecastData[0]?.Prévision ? '#ef4444' : '#16a34a' }}>
              {forecastData.length >= 2
                ? (forecastData[forecastData.length-1]?.Prévision > forecastData[0]?.Prévision ? '↑ Hausse' : '↓ Baisse')
                : '—'}
            </div>
          </div>
        </div>

        <div className="fc-modal-chart-label">
          Prévisions de licenciements avec référence à cet indicateur
        </div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartPoints} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="gModalForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={indicator.color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={indicator.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" stroke="#a3a3a3" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#a3a3a3" fontSize={12} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Prévision"
                stroke={indicator.color} fill="url(#gModalForecast)"
                strokeWidth={2.5} dot={{ r: 5, fill: indicator.color, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7 }} name="Prévision" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="fc-modal-footer">
          <div className="fc-modal-badge" style={{ background: indicator.color + '15', color: indicator.color }}>
            <Icon size={12} />
            {indicator.label} : {displayVal}
          </div>
          <span className="fc-modal-note">Cliquez en dehors pour fermer</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Fullscreen Chart Overlay ─────────────────────── */
function FullscreenContent({ historicalBars, forecastLine, forecastData, hasCIBand, histDomain, fcDomain, period, stats, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fc-fs-overlay" onClick={onClose}>
      <div className="fc-fs-box" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="fc-fs-header">
          <div className="fc-fs-header-left">
            <span className="fc-fs-title">Historique &amp; Prévisions</span>
            {stats && (
              <div className="fc-fs-stats">
                <span><b>{stats.total.toLocaleString()}</b> prévu total</span>
                <span className="fc-fs-sep" />
                <span><b>{stats.avg.toLocaleString()}</b> moy / période</span>
                <span className="fc-fs-sep" />
                <span style={{ color: stats.trend > 0 ? '#ef4444' : '#16a34a' }}>
                  {stats.trend > 0 ? '↑' : '↓'} {Math.abs(stats.trend).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <button className="fc-fs-close" onClick={onClose}>
            <X size={16} /> Fermer &nbsp;<kbd>Échap</kbd>
          </button>
        </div>

        {/* ── Two charts side by side ── */}
        <div className="fc-fs-body">

          {/* Historical */}
          <div className="fc-fs-panel">
            <div className="fc-fs-panel-head">
              <BarChart2 size={13} />
              <span>Historique Mensuel Réel</span>
              <span className="fc-chip" style={{ marginLeft: 'auto' }}>{historicalBars.length} mois</span>
            </div>
            <div className="fc-fs-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historicalBars} margin={{ top: 10, right: 20, bottom: 20, left: 0 }} barCategoryGap="28%">
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false}
                    angle={-30} textAnchor="end" height={48} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false}
                    tickFormatter={fmt} domain={histDomain} width={52} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="Licenciements" name="Licenciements" radius={[5, 5, 0, 0]}>
                    {historicalBars.map((_, i) => (
                      <Cell key={i} fill={`hsl(220,10%,${58 - i * 5}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Forecast */}
          <div className="fc-fs-panel">
            <div className="fc-fs-panel-head">
              <TrendingUp size={13} style={{ color: '#3b82f6' }} />
              <span>Prévisions {period === 'quarterly' ? 'Trimestrielles' : 'Semestrielles'}</span>
              {hasCIBand && <span className="fc-chip fc-chip-blue" style={{ marginLeft: 8 }}>IC 80%</span>}
              <span className="fc-chip" style={{ marginLeft: 'auto' }}>{forecastLine.length} périodes</span>
            </div>
            <div className="fc-fs-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={forecastLine} margin={{ top: 10, right: 24, bottom: 20, left: 0 }}>
                  <defs>
                    <linearGradient id="gFcFS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="gBandFS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={13} tickLine={false} axisLine={false}
                    angle={-20} textAnchor="end" height={48} />
                  <YAxis stroke="#94a3b8" fontSize={13} tickLine={false} axisLine={false}
                    tickFormatter={fmt} domain={fcDomain} width={56} />
                  <Tooltip content={<ChartTooltip />} />
                  {hasCIBand && (
                    <>
                      <Area type="monotone" dataKey="bandBottom" stroke="none"
                        fill="transparent" fillOpacity={0} stackId="ci" legendType="none" name="CI Min" />
                      <Area type="monotone" dataKey="bandWidth" stroke="none"
                        fill="url(#gBandFS)" fillOpacity={1} stackId="ci" legendType="none" name="IC 80%" />
                    </>
                  )}
                  <Area type="monotone" dataKey="Prévision"
                    stroke="#3b82f6" fill="url(#gFcFS)"
                    strokeWidth={3} strokeDasharray="8 4"
                    dot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2.5 }}
                    activeDot={{ r: 8, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                    name="Prévision" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="fc-legend" style={{ paddingBottom: 8 }}>
              <span className="fc-legend-item"><span className="fc-legend-dot" style={{ background: '#3b82f6' }} />Prévision</span>
              {hasCIBand && <span className="fc-legend-item"><span className="fc-legend-dot" style={{ background: 'rgba(59,130,246,0.24)' }} />IC 80%</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════ */
/* ── Main Page ───────────────────────────────────── */
/* ═══════════════════════════════════════════════════ */
export default function PredictionPage() {
  const [countries, setCountries]         = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [industries, setIndustries]       = useState([])
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [period, setPeriod]               = useState('quarterly')
  const [context, setContext]             = useState(null)
  const [features, setFeatures]           = useState(null)
  const [forecast, setForecast]           = useState(null)
  const [loading, setLoading]             = useState(false)
  const [loadingCtx, setLoadingCtx]       = useState(false)
  const [activeIndicator, setActiveIndicator] = useState(null)  // for modal
  const [fullscreen, setFullscreen]       = useState(false)

  useEffect(() => {
    fetchFilters().then(d => setCountries(d.countries || [])).catch(console.error)
  }, [])

  const handleCountryChange = async (e) => {
    const c = e.target.value
    setSelectedCountry(c); setSelectedIndustry(''); setForecast(null); setFeatures(null); setContext(null); setIndustries([])
    if (!c) return
    setLoadingCtx(true)
    try {
      const d = await fetchCountryFeatures(c)
      setFeatures(d.features); setContext(d.context)
      setIndustries(d.context?.country_industries || [])
    } catch (err) { console.error(err) } finally { setLoadingCtx(false) }
  }

  const handleIndustryChange = async (e) => {
    const ind = e.target.value
    setSelectedIndustry(ind); setForecast(null)
    if (!selectedCountry) return
    setLoadingCtx(true)
    try {
      const d = await fetchCountryFeatures(selectedCountry, ind || null)
      setFeatures(d.features); setContext(d.context)
    } catch (err) { console.error(err) } finally { setLoadingCtx(false) }
  }

  const handlePeriodChange = useCallback((p) => {
    setPeriod(p); setForecast(null)
  }, [])

  const handleForecast = async () => {
    if (!features || !selectedCountry) return
    setLoading(true)
    try {
      const result = await postForecast(selectedCountry, period, selectedIndustry || null, 4)
      setForecast(result)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  /* ─── Historical monthly data ───────────────────── */
  const historicalBars = useMemo(() => {
    if (!forecast?.historical?.length) return []
    return forecast.historical
      .filter(h => h.month)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(h => ({ name: h.month, Licenciements: safe(h.total) }))
  }, [forecast])

  /* ─── Forecast line data ────────────────────────── */
  const forecastLine = useMemo(() => {
    if (!forecast?.predictions?.length) return []
    return forecast.predictions.map((p, i) => {
      const pred = safe(p.predicted_layoffs)
      const lo   = safe(p.lower_bound)
      const hi   = safe(p.upper_bound)
      const ciOk = lo > 10
      return {
        name      : p.period || `P+${i+1}`,
        Prévision : pred,
        bandBottom: ciOk ? lo : null,
        bandWidth : ciOk ? Math.max(0, hi - lo) : null,
        trend     : p.trend,
      }
    })
  }, [forecast])

  /* ─── Domains ───────────────────────────────────── */
  const histDomain = useMemo(() => {
    if (!historicalBars.length) return [0, 'auto']
    const max = Math.max(...historicalBars.map(d => d.Licenciements))
    return [0, Math.ceil(max * 1.2)]
  }, [historicalBars])

  const fcDomain = useMemo(() => {
    if (!forecastLine.length) return [0, 'auto']
    const vals = forecastLine.map(d => d.Prévision)
    const cis  = forecastLine.filter(d => d.bandBottom !== null).map(d => (d.bandBottom || 0) + (d.bandWidth || 0))
    const max  = Math.max(...vals, ...cis)
    return [0, Math.ceil(max * 1.25)]
  }, [forecastLine])

  const hasCIBand = useMemo(() => forecastLine.some(d => d.bandBottom !== null), [forecastLine])

  /* ─── Summary stats ─────────────────────────────── */
  const stats = useMemo(() => {
    if (!forecast?.predictions?.length) return null
    const preds = forecast.predictions
    const total = preds.reduce((s, p) => s + safe(p.predicted_layoffs), 0)
    const avg   = Math.round(total / preds.length)
    const trend = preds.length >= 2
      ? safe(preds[preds.length-1].predicted_layoffs) - safe(preds[0].predicted_layoffs)
      : 0
    return { total, avg, trend, count: preds.length }
  }, [forecast])

  /* ─── Indicator values ──────────────────────────── */
  const indicators = useMemo(() => {
    if (!forecast?.base_indicators) return []
    return INDICATOR_META.map(m => ({ ...m, value: safe(forecast.base_indicators[m.key]) }))
  }, [forecast])

  /* ─── Feature importance ────────────────────────── */
  const topFeatures = useMemo(() => {
    if (!forecast?.feature_importance) return []
    return Object.entries(forecast.feature_importance)
      .map(([k, v]) => [k, safe(v)])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
  }, [forecast])
  const maxImp = topFeatures[0]?.[1] || 1

  /* ─── Chart content (normal view only) ─────────────── */
  const renderCharts = () => (
    <div className="fc-charts-stack">
      {/* ── Historical Bars ── */}
      <div className="fc-chart-card">
        <div className="fc-chart-card-head">
          <span className="fc-chart-card-title">
            <BarChart2 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Historique Mensuel Réel
          </span>
          <span className="fc-chip">{historicalBars.length} mois</span>
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={historicalBars} margin={{ top: 6, right: 16, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={fmt} domain={histDomain} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="Licenciements" name="Licenciements" radius={[4, 4, 0, 0]}>
                {historicalBars.map((_, i) => (
                  <Cell key={i} fill={`hsl(220,9%,${60 - i * 5}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Forecast Line ── */}
      <div className="fc-chart-card">
        <div className="fc-chart-card-head">
          <span className="fc-chart-card-title">
            <TrendingUp size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: '#3b82f6' }} />
            Prévisions {period === 'quarterly' ? 'Trimestrielles' : 'Semestrielles'}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {hasCIBand && <span className="fc-chip fc-chip-blue">IC 80%</span>}
            <span className="fc-chip">{forecastLine.length} périodes</span>
          </div>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecastLine} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gFcN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="gBandN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={fmt} domain={fcDomain} width={50} />
              <Tooltip content={<ChartTooltip />} />
              {hasCIBand && (
                <>
                  <Area type="monotone" dataKey="bandBottom" stroke="none"
                    fill="transparent" fillOpacity={0} stackId="ci" legendType="none" name="CI Min" />
                  <Area type="monotone" dataKey="bandWidth" stroke="none"
                    fill="url(#gBandN)" fillOpacity={1} stackId="ci" legendType="none" name="IC 80%" />
                </>
              )}
              <Area type="monotone" dataKey="Prévision"
                stroke="#3b82f6" fill="url(#gFcN)"
                strokeWidth={2.5} strokeDasharray="7 4"
                dot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                name="Prévision" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="fc-legend">
          <span className="fc-legend-item"><span className="fc-legend-dot" style={{ background: '#3b82f6' }} />Prévision</span>
          {hasCIBand && (
            <span className="fc-legend-item"><span className="fc-legend-dot" style={{ background: 'rgba(59,130,246,0.22)' }} />IC 80%</span>
          )}
        </div>
      </div>
    </div>
  )



  /* ══════════════════════ JSX ═══════════════════════ */
  return (
    <>
      {/* ── Page Header ─────────────────────────────── */}
      <div className="page-head">
        <h1>Prévision des Licenciements</h1>
        <p>Modèle prédictif XGBoost multi-périodes — sélectionnez un pays, un secteur et un horizon</p>
      </div>

      <div className="fc-layout">
        {/* ══ LEFT SIDEBAR ════════════════════════════ */}
        <aside className="fc-sidebar">

          {/* Config card */}
          <div className="fc-card">
            <div className="fc-card-head">
              <div className="fc-card-icon"><CalendarRange size={15} /></div>
              <div>
                <h3>Configuration</h3>
                <p>Paramètres de la prévision</p>
              </div>
            </div>

            <label className="fc-label">Pays / Région</label>
            <div className="select-wrapper" id="country-select">
              <select value={selectedCountry} onChange={handleCountryChange}>
                <option value="">Choisir un pays…</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <label className="fc-label" style={{ marginTop: 10 }}>
              <Factory size={13} style={{ display:'inline', verticalAlign:'middle', marginRight:5 }} />
              Secteur
            </label>
            <div className="select-wrapper" id="industry-select">
              <select value={selectedIndustry} onChange={handleIndustryChange}
                disabled={!selectedCountry || !industries.length}>
                <option value="">Tous les secteurs</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <label className="fc-label" style={{ marginTop: 10 }}>Granularité</label>
            <div className="fc-period-toggle" id="period-select">
              <button className={`fc-period-btn ${period==='quarterly'?'active':''}`}
                onClick={() => handlePeriodChange('quarterly')}>
                Trimestrielle
              </button>
              <button className={`fc-period-btn ${period==='semiannual'?'active':''}`}
                onClick={() => handlePeriodChange('semiannual')}>
                Semestrielle
              </button>
            </div>

            {loadingCtx && (
              <div className="fc-inline-loading"><div className="spinner" /> Chargement…</div>
            )}

            {context && (
              <div className="fc-context-box fade-in">
                {[
                  ['Pays',               context.country],
                  context.industry ? ['Secteur', context.industry] : null,
                  ['Total Licenciements', safe(context.country_total_layoffs).toLocaleString()],
                  ['Événements',          safe(context.country_total_events).toLocaleString()],
                  ['Industrie #1',        context.country_top_industry || '—'],
                  context.country_unemployment != null ? ['Chômage', `${safe(context.country_unemployment)}%`] : null,
                ].filter(Boolean).map(([label, val], i) => (
                  <div key={i} className="fc-context-row">
                    <span className="fc-context-label">{label}</span>
                    <span className="fc-context-val">{val}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="fc-generate-btn" onClick={handleForecast}
              disabled={!features || loading} id="forecast-btn">
              {loading
                ? <><div className="spinner-white" /> Analyse en cours…</>
                : <><Brain size={14} /> Générer la Prévision</>
              }
            </button>
          </div>

          {/* Info card */}
          <div className="fc-card fc-info-card">
            <div className="fc-card-head">
              <div className="fc-card-icon fc-card-icon--blue"><Info size={15} /></div>
              <div>
                <h3>À propos du modèle</h3>
                <p>XGBoost — Gradient Boosting</p>
              </div>
            </div>
            <p className="fc-info-text">
              Modèle entraîné sur des données historiques de licenciements, indicateurs macro-économiques
              et features temporelles (lags, rolling, tendances saisonnières).
            </p>
            <div className="fc-tags">
              <span className="fc-tag"><ShieldCheck size={11} /> Temporal split</span>
              <span className="fc-tag"><Activity size={11} /> Cascade prediction</span>
              <span className="fc-tag"><Brain size={11} /> 19 features</span>
            </div>
          </div>
        </aside>

        {/* ══ RIGHT RESULTS ═══════════════════════════ */}
        <main className="fc-main">

          {/* Empty state */}
          {!forecast && !loading && (
            <div className="fc-empty">
              <div className="fc-empty-icon"><BarChart3 size={44} strokeWidth={1.2} /></div>
              <h4>Aucune prévision générée</h4>
              <p>Sélectionnez un pays, un secteur et une période puis cliquez sur Générer</p>
              <div className="fc-empty-steps">
                {['Choisir un pays','Choisir un secteur','Sélectionner la période','Générer'].map((s,i) => (
                  <div key={i} className="fc-empty-steps-row">
                    <span className="fc-step-num">{i+1}</span>
                    <span>{s}</span>
                    {i < 3 && <ChevronRight size={12} style={{ color:'#d1d5db', marginLeft:4 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="fc-loading">
              <div className="fc-pulse-ring" />
              <p>Analyse prédictive en cours…</p>
              <span>Le modèle calcule les tendances futures</span>
            </div>
          )}

          {/* Results */}
          {forecast && !loading && (
            <div className="fc-results fade-in">

              {/* ── KPI Strip ─────────────────────── */}
              {stats && (
                <div className="fc-kpi-strip">
                  {[
                    { label: 'Total Prévu',        value: stats.total.toLocaleString(), sub: `${stats.count} périodes` },
                    { label: 'Moy. / Période',     value: stats.avg.toLocaleString(),   sub: 'licenciements' },
                    { label: 'Variation',          value: (stats.trend > 0 ? '+' : '') + stats.trend.toLocaleString(),
                      sub: stats.trend > 0 ? '↑ hausse' : '↓ baisse',
                      accent: stats.trend > 0 ? '#ef4444' : '#16a34a' },
                    { label: 'Modèle',             value: forecast.model_used || 'XGBoost', sub: 'algorithme' },
                  ].map((k, i) => (
                    <div key={i} className="fc-kpi">
                      <div className="fc-kpi-label">{k.label}</div>
                      <div className="fc-kpi-value" style={k.accent ? { color: k.accent } : {}}>{k.value}</div>
                      <div className="fc-kpi-sub">{k.sub}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Charts Block ─────────────────── */}
              <div className="fc-charts-block">
                <div className="fc-charts-block-head">
                  <span className="fc-section-title">Historique & Prévisions</span>
                  <button className="fc-expand-btn" onClick={() => setFullscreen(true)}
                    title="Agrandir en plein écran">
                    <Maximize2 size={14} /> Plein écran
                  </button>
                </div>
                {renderCharts(false)}
              </div>

              {/* ── Bar Chart per period ─────────── */}
              <div className="fc-section-block">
                <div className="fc-section-head">
                  <span className="fc-section-title">Détail par Période</span>
                  <span className="fc-chip">{forecastLine.length} périodes</span>
                </div>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecastLine} margin={{ top: 6, right: 16, bottom: 0, left: 0 }} barCategoryGap="35%">
                      <CartesianGrid stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false}
                        tickFormatter={fmt} width={44} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                      <Bar dataKey="Prévision" name="Prévu" radius={[5, 5, 0, 0]}>
                        {forecastLine.map((_, i) => (
                          <Cell key={i} fill="#3b82f6"
                            fillOpacity={0.4 + (i / forecastLine.length) * 0.55} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── Indicators grid ──────────────── */}
              {indicators.length > 0 && (
                <div className="fc-section-block">
                  <div className="fc-section-head">
                    <span className="fc-section-title">Indicateurs du Modèle</span>
                    <span className="fc-chip fc-chip-info">Cliquez pour voir le graphique</span>
                  </div>
                  <div className="fc-indicators-grid">
                    {indicators.map(ind => {
                      const Icon = ind.icon
                      const val  = ind.format ? ind.format(ind.value) : `${safe(ind.value)}${ind.unit||''}`
                      return (
                        <button key={ind.key} className="fc-indicator-btn"
                          onClick={() => setActiveIndicator(ind)}
                          id={`indicator-${ind.key}`}>
                          <div className="fc-indicator-top">
                            <div className="fc-indicator-icon"
                              style={{ background: ind.color + '15', color: ind.color }}>
                              <Icon size={15} />
                            </div>
                            <ZoomIn size={12} className="fc-indicator-zoom" />
                          </div>
                          <div className="fc-indicator-value" style={{ color: ind.color }}>{val}</div>
                          <div className="fc-indicator-label">{ind.label}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Feature importance ───────────── */}
              {topFeatures.length > 0 && (
                <div className="fc-section-block">
                  <div className="fc-section-head">
                    <span className="fc-section-title">Importance des Variables</span>
                    <span className="fc-chip">Top {topFeatures.length}</span>
                  </div>
                  <div className="fc-importance-list">
                    {topFeatures.map(([name, value], i) => (
                      <div key={name} className="fc-importance-row" style={{ animationDelay: `${i*40}ms` }}>
                        <span className="fc-importance-label">{name.replace(/_/g, ' ')}</span>
                        <div className="fc-importance-track">
                          <div className="fc-importance-bar" style={{
                            width: `${maxImp > 0 ? (value/maxImp)*100 : 0}%`,
                            background: i === 0 ? '#3b82f6' : i < 3 ? '#0a0a0a' : '#d1d5db',
                          }} />
                        </div>
                        <span className="fc-importance-pct">{(safe(value)*100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Alert & Factors ──────────────── */}
              {(forecast.alert || forecast.top_factors?.length > 0) && (
                <div className="fc-section-block">
                  <div className="fc-section-head">
                    <span className="fc-section-title">Analyse & Alertes</span>
                  </div>
                  {forecast.alert && (
                    <div className={`forecast-alert ${
                      forecast.alert.includes('ÉLEVÉ') ? 'alert-high'
                      : forecast.alert.includes('POSITIF') ? 'alert-positive'
                      : 'alert-moderate'}`}>
                      <AlertTriangle size={15} />
                      <span>{forecast.alert}</span>
                    </div>
                  )}
                  {forecast.top_factors?.length > 0 && (
                    <ul className="fc-factors">
                      {forecast.top_factors.map((f, i) => (
                        <li key={i} className="fc-factor-item">
                          <ChevronRight size={13} style={{ color:'#3b82f6', flexShrink:0 }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

            </div>
          )}
        </main>
      </div>

      {/* ── Fullscreen Overlay ──────────────────────── */}
      {fullscreen && (
        <FullscreenContent
          historicalBars={historicalBars}
          forecastLine={forecastLine}
          hasCIBand={hasCIBand}
          histDomain={histDomain}
          fcDomain={fcDomain}
          period={period}
          stats={stats}
          onClose={() => setFullscreen(false)}
        />
      )}

      {/* ── Indicator Modal ─────────────────────────── */}
      {activeIndicator && (
        <IndicatorModal
          indicator={activeIndicator}
          forecastData={forecastLine}
          onClose={() => setActiveIndicator(null)}
        />
      )}
    </>
  )
}
