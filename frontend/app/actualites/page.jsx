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
    <div style={{ overflowX: 'hidden' }}>
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

      {/* ── Actualités du Marché ── */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-head">
          <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Newspaper size={18} />
            Actualités du Marché
          </span>
          <span className="panel-badge">NewsAPI</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, overflowX: 'hidden' }}>
          {news.map((n, i) => (
            <a
              key={i}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="news-card"
              style={{
                display: 'flex',
                gap: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid #e5e5e5',
                borderRadius: 12,
                padding: 14,
                transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                backgroundColor: '#fff',
                animation: `fadeIn 0.4s ease ${i * 0.04}s both`,
              }}
            >
              {n.urlToImage && (
                <img
                  src={n.urlToImage}
                  alt=""
                  style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 10, backgroundColor: '#f0f0f0', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 13, color: '#525252', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {n.description}
                </div>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>
                  {n.source} • {new Date(n.date).toLocaleDateString()}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ── Chômage Mondial ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            🌍 Chômage Mondial
          </span>
          <span className="panel-badge">Banque Mondiale</span>
        </div>

        {worldEconomy.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {worldEconomy.map((we, i) => {
              const rate = parseFloat(we.unemployment_rate) || 0
              const color = rate > 15 ? '#dc2626' : rate > 10 ? '#d97706' : rate > 5 ? '#2563eb' : '#16a34a'
              const bgColor = rate > 15 ? 'rgba(220,38,38,0.06)' : rate > 10 ? 'rgba(217,119,6,0.06)' : rate > 5 ? 'rgba(37,99,235,0.06)' : 'rgba(22,163,74,0.06)'
              return (
                <div
                  key={i}
                  style={{
                    border: '1px solid #e5e5e5',
                    borderRadius: 12,
                    padding: '14px 16px',
                    transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
                    cursor: 'default',
                    animation: `fadeIn 0.35s ease ${i * 0.03}s both`,
                    background: '#fff',
                  }}
                  className="unemp-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{we.country}</div>
                      <div style={{ fontSize: 11, color: '#a3a3a3', fontWeight: 500 }}>{we.year}</div>
                    </div>
                    <div style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color,
                      background: bgColor,
                      padding: '4px 10px',
                      borderRadius: 8,
                      letterSpacing: '-0.5px',
                    }}>
                      {we.unemployment_rate}%
                    </div>
                  </div>
                  <div style={{ height: 6, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(rate * 2.5, 100)}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${color}cc, ${color})`,
                        borderRadius: 4,
                        transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .news-card:hover { border-color: #2563eb !important; transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
        .unemp-card:hover { border-color: #d4d4d4 !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
      `}} />
    </div>
  )
}
