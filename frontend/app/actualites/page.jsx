'use client'
import { useState, useEffect, useCallback } from 'react'
import { Newspaper } from 'lucide-react'
import { fetchMarketNews, fetchTrendingNews, fetchWorldEconomy } from '@/lib/api'

export default function Actualites() {
  const [news, setNews] = useState([])
  const [trendingNews, setTrendingNews] = useState([])
  const [worldEconomy, setWorldEconomy] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [n, tn, we] = await Promise.all([
        fetchMarketNews(),
        fetchTrendingNews(),
        fetchWorldEconomy()
      ])
      setNews(n?.articles || [])
      setTrendingNews(tn?.articles || [])
      setWorldEconomy(we?.data || [])
    } catch (e) {
      console.error(e)
      setError('Impossible de se connecter aux APIs d\'actualités.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (error) return (
    <div className="page-loader" style={{ flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <p style={{ color: '#ef4444', fontWeight: 600, fontSize: 15 }}>{error}</p>
      <button onClick={loadData} className="page-btn" style={{ padding: '10px 28px', fontSize: 14, marginTop: 8, cursor: 'pointer', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8 }}>
        Réessayer
      </button>
    </div>
  )

  if (loading) return <div className="page-loader"><div className="spinner" /></div>

  return (
    <>
      <div className="page-head">
        <h1>Actualités & Tendances</h1>
        <p>Toutes les informations en temps réel sur le marché du travail</p>
      </div>

      {/* Trending News Ticker */}
      {trendingNews.length > 0 && (
        <div style={{ background: '#0a0a0a', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 24, display: 'flex', overflow: 'hidden', width: '100%' }}>
          <div style={{ fontWeight: 600, marginRight: 16, borderRight: '1px solid #333', paddingRight: 16, whiteSpace: 'nowrap' }}>⚡ TENDANCES</div>
          <div className="ticker-wrap" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <div className="ticker" style={{ display: 'inline-block', whiteSpace: 'nowrap', animation: 'ticker 30s linear infinite' }}>
              {trendingNews.map((n, i) => (
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ color: '#e5e5e5', marginRight: 40, textDecoration: 'none' }}>
                  {n.title} <span style={{ color: '#666', fontSize: 11 }}>({n.source})</span>
                </a>
              ))}
            </div>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes ticker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
            .ticker-wrap:hover .ticker { animation-play-state: paused; }
          `}} />
        </div>
      )}

      <div className="chart-grid">
        {/* Market News Cards */}
        <div className="panel span-8">
          <div className="panel-head">
            <span className="panel-title" style={{display:'flex', alignItems:'center', gap:6}}><Newspaper size={16}/> Actualités du Marché</span>
            <span className="panel-badge">NewsAPI</span>
          </div>
          <div style={{ height: 600, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 8 }}>
            {news.map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: 16, textDecoration: 'none', color: 'inherit', border: '1px solid #eee', borderRadius: 12, padding: 12, transition: 'all 0.2s', backgroundColor: '#fff' }} className="news-card">
                {n.urlToImage && <img src={n.urlToImage} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, backgroundColor: '#f0f0f0' }} />}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: '#525252', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.description}</div>
                  <div style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>{n.source} • {new Date(n.date).toLocaleDateString()}</div>
                </div>
              </a>
            ))}
          </div>
          <style dangerouslySetInnerHTML={{__html: `.news-card:hover { border-color: #2563eb !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }`}} />
        </div>

        {/* World Economy (Unemployment) */}
        <div className="panel span-4">
          <div className="panel-head"><span className="panel-title">Chômage Mondial</span><span className="panel-badge">Banque Mondiale</span></div>
          <div style={{ height: 600, overflowY: 'auto', paddingRight: 8 }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead><tr><th>Pays</th><th style={{textAlign:'right'}}>Taux (%)</th></tr></thead>
              <tbody>
                {worldEconomy.map((we, i) => (
                  <tr key={i}>
                    <td>{we.country} <span style={{fontSize:9, color:'#888'}}>({we.year})</span></td>
                    <td style={{textAlign:'right', fontWeight:600}}>{we.unemployment_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
