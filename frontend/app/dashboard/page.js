'use client'
import { useState, useEffect, useCallback } from 'react'
import { TrendingDown, Building2, Cpu, Globe2, Users, Zap } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import FilterBar from '@/components/FilterBar'
import { fetchFilters, fetchSummary, fetchMonthly, fetchByCountry, fetchByIndustry, fetchSentiment, fetchEvents } from '@/lib/api'

const PAL = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

function Tip({ active, payload, label }) {
  if (!active || !payload) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e5e5', borderRadius:8, padding:'8px 12px', boxShadow:'0 4px 6px rgba(0,0,0,0.06)' }}>
      <p style={{ color:'#a3a3a3', fontSize:11, fontWeight:600, marginBottom:4 }}>{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color:e.color, fontSize:12, padding:'1px 0' }}>
          {e.name}: <strong>{Number(e.value).toLocaleString()}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [filterOpts, setFilterOpts] = useState({ countries: [], industries: [] })
  const [filters, setFilters] = useState({})
  const [summary, setSummary] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [byCountry, setByCountry] = useState([])
  const [byIndustry, setByIndustry] = useState([])
  const [sentiment, setSentiment] = useState([])
  const [events, setEvents] = useState({ data: [], total: 0, page: 1, pages: 1 })
  const [eventsPage, setEventsPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showLayoffsOnSentiment, setShowLayoffsOnSentiment] = useState(false)

  // Load filter options once
  useEffect(() => { fetchFilters().then(setFilterOpts).catch(console.error) }, [])

  // Load sentiment once (not filterable)
  useEffect(() => { fetchSentiment().then(setSentiment).catch(console.error) }, [])

  // Load filtered data when filters change
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, m, bc, bi] = await Promise.all([
        fetchSummary(filters),
        fetchMonthly(filters),
        fetchByCountry(filters),
        fetchByIndustry(filters),
      ])
      setSummary(s); setMonthly(m); setByCountry(bc); setByIndustry(bi)
      // Reset events to page 1
      const ev = await fetchEvents({ ...filters, page: 1, limit: 20 })
      setEvents(ev); setEventsPage(1)
    } catch (e) {
      console.error(e)
      setError('Impossible de se connecter au backend. Vérifiez que le serveur est lancé sur le port 8000.')
    }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { loadData() }, [loadData])

  // Load events page
  const loadEventsPage = async (p) => {
    try {
      const ev = await fetchEvents({ ...filters, page: p, limit: 20 })
      setEvents(ev); setEventsPage(p)
    } catch (e) { console.error(e) }
  }

  if (error && !summary) return (
    <div className="page-loader" style={{ flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <p style={{ color: '#ef4444', fontWeight: 600, fontSize: 15, textAlign: 'center', maxWidth: 420 }}>{error}</p>
      <button onClick={loadData} className="page-btn" style={{ padding: '10px 28px', fontSize: 14, marginTop: 8, cursor: 'pointer', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8 }}>
        Réessayer
      </button>
    </div>
  )

  if (!summary) return <div className="page-loader"><div className="spinner" /></div>

  const mData = monthly.map(d => ({ name: d.month, 'Total': d.total, 'IA': d.ai }))
  const sData = sentiment.map(d => {
    const m = monthly.find(x => x.month === d.month)
    return { name: d.month, Sentiment: d.sentiment, Licenciements: m ? m.total : 0 }
  })

  return (
    <>
      <div className="page-head">
        <h1>Tableau de Bord</h1>
        <p>Aperçu mondial du marché du travail · filtré et agrégé</p>
      </div>

      <FilterBar filters={filters} setFilters={setFilters}
        countries={filterOpts.countries} industries={filterOpts.industries} />

      {/* KPIs */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-top"><span className="metric-label">Licenciements Totaux</span><div className="metric-icon rose"><TrendingDown size={14}/></div></div>
          <div className="metric-value">{summary.total_layoffs.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-top"><span className="metric-label">Événements</span><div className="metric-icon indigo"><Zap size={14}/></div></div>
          <div className="metric-value">{summary.total_events.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-top"><span className="metric-label">Entreprises</span><div className="metric-icon amber"><Building2 size={14}/></div></div>
          <div className="metric-value">{summary.total_companies.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-top"><span className="metric-label">Taille Moyenne</span><div className="metric-icon emerald"><Users size={14}/></div></div>
          <div className="metric-value">{summary.avg_layoff_size.toLocaleString()}</div>
        </div>
      </div>

      <div className="chart-grid">
        {/* Trend */}
        <div className="panel span-12">
          <div className="panel-head"><span className="panel-title">Volume Mensuel de Licenciements</span><span className="panel-badge">{mData.length} mois</span></div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mData}>
                <defs>
                  <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a0a0a" stopOpacity={0.08}/><stop offset="100%" stopColor="#0a0a0a" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.1}/><stop offset="100%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="name" stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                <YAxis stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                <Tooltip content={<Tip/>}/>
                <Area type="monotone" dataKey="Total" stroke="#0a0a0a" fill="url(#gT)" strokeWidth={1.5} dot={false}/>
                <Area type="monotone" dataKey="IA" stroke="#2563eb" fill="url(#gA)" strokeWidth={1.5} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span className="chart-legend-item"><span className="chart-legend-dot" style={{background:'#0a0a0a'}}/>Total</span>
            <span className="chart-legend-item"><span className="chart-legend-dot" style={{background:'#2563eb'}}/>Lié à l'IA</span>
          </div>
        </div>

        {/* Industry */}
        <div className="panel span-6">
          <div className="panel-head"><span className="panel-title">Principales Industries</span><span className="panel-badge">Top 10</span></div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byIndustry} layout="vertical" margin={{left:8,right:16}}>
                <CartesianGrid stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                <YAxis dataKey="industry" type="category" stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} width={100}/>
                <Tooltip content={<Tip/>}/>
                <Bar dataKey="total" name="Licenciements" radius={[0,3,3,0]} fill="#0a0a0a" fillOpacity={0.75}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Country donut */}
        <div className="panel span-6">
          <div className="panel-head"><span className="panel-title">Par Pays</span><span className="panel-badge">Top 10</span></div>
          <div style={{ height: 240, display:'flex', alignItems:'center' }}>
            <ResponsiveContainer width="45%" height="100%">
              <PieChart>
                <Pie data={byCountry} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={2} dataKey="total" stroke="none">
                  {byCountry.map((_,i)=><Cell key={i} fill={PAL[i%PAL.length]}/>)}
                </Pie>
                <Tooltip content={<Tip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{flex:1,paddingLeft:4}}>
              {byCountry.map((c,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'2.5px 0',fontSize:11}}>
                  <span className="chart-legend-dot" style={{background:PAL[i%PAL.length],flexShrink:0}}/>
                  <span style={{color:'#525252',flex:1}}>{c.country}</span>
                  <span style={{fontWeight:600,color:'#0a0a0a'}}>{c.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sentiment */}
        {sData.length > 0 && (
          <div className="panel span-12">
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><span className="panel-title">Sentiment de l'Actualité</span><span className="panel-badge">NLP</span></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: '#525252' }}>
                <input 
                  type="checkbox" 
                  checked={showLayoffsOnSentiment} 
                  onChange={e => setShowLayoffsOnSentiment(e.target.checked)} 
                  style={{ cursor: 'pointer', margin: 0 }}
                />
                Comparer avec Licenciements
              </label>
            </div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sData}>
                  <CartesianGrid stroke="#f0f0f0" vertical={false}/>
                  <XAxis dataKey="name" stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                  <YAxis yAxisId="left" stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} domain={[-1,1]}/>
                  {showLayoffsOnSentiment && (
                    <YAxis yAxisId="right" orientation="right" stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                  )}
                  <Tooltip content={<Tip/>}/>
                  {showLayoffsOnSentiment && (
                    <Line yAxisId="right" type="monotone" dataKey="Licenciements" stroke="#0a0a0a" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  )}
                  <Line yAxisId="left" type="monotone" dataKey="Sentiment" stroke="#16a34a" strokeWidth={1.5} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Events Table */}
        <div className="panel span-12">
          <div className="panel-head"><span className="panel-title">Événements Récents</span><span className="panel-badge">{events.total} total</span></div>
          <table className="data-table">
            <thead><tr>
              <th>Entreprise</th><th>Pays</th><th>Industrie</th><th>Date</th><th>IA</th><th>Licenciements</th>
            </tr></thead>
            <tbody>
              {events.data.map((e,i) => (
                <tr key={i}>
                  <td>{e.company}</td>
                  <td>{e.country}</td>
                  <td>{e.industry}</td>
                  <td>{e.date}</td>
                  <td><span className={`ai-badge ${e.is_ai?'yes':'no'}`}>{e.is_ai?'IA':'—'}</span></td>
                  <td>{e.layoff_count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span>Page {eventsPage} sur {events.pages}</span>
            <div className="pagination-btns">
              <button className="page-btn" disabled={eventsPage<=1} onClick={()=>loadEventsPage(eventsPage-1)}>Précédent</button>
              <button className="page-btn" disabled={eventsPage>=events.pages} onClick={()=>loadEventsPage(eventsPage+1)}>Suivant</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
