'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { User, Compass, Bookmark, FileText, MessageCircle, Trash2, ExternalLink, Download, Eye, ChevronRight, LineChart } from 'lucide-react'

export default function Profile() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('profile')
  const [data, setData] = useState({
    recos: [], jobs: [], cvs: [], history: [], predictions: []
  })
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: null, id: null })

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    try {
      const [r, j, c, h, p] = await Promise.all([
        fetch('/api/user/recommendations', { cache: 'no-store' }).then(res => res.json()),
        fetch('/api/user/saved-jobs', { cache: 'no-store' }).then(res => res.json()),
        fetch('/api/user/cvs', { cache: 'no-store' }).then(res => res.json()),
        fetch('/api/user/jobly-history', { cache: 'no-store' }).then(res => res.json()),
        fetch('/api/user/predictions', { cache: 'no-store' }).then(res => res.json())
      ])
      setData({
        recos: Array.isArray(r) ? r : [],
        jobs: Array.isArray(j) ? j : [],
        cvs: Array.isArray(c) ? c : [],
        history: Array.isArray(h) ? h : [],
        predictions: Array.isArray(p) ? p : []
      })
    } catch (err) {
      console.error('Failed to fetch data', err)
    }
  }

  const handleDeleteClick = (type, id) => {
    setDeleteModal({ isOpen: true, type, id })
  }

  const confirmDelete = async () => {
    const { type, id } = deleteModal
    if (!type || !id) return
    
    try {
      await fetch(`/api/user/${type}/${id}`, { method: 'DELETE' })
      fetchData()
    } catch (err) {
      console.error('Delete failed', err)
    } finally {
      setDeleteModal({ isOpen: false, type: null, id: null })
    }
  }

  const cancelDelete = () => setDeleteModal({ isOpen: false, type: null, id: null })

  if (!session) return null

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Mon Espace</h1>
        <p>Gérez vos recommandations, offres sauvegardées, CVs et historique.</p>
      </div>

      <div className="profile-tabs">
        <button className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          <User size={16} style={{marginRight: 6, verticalAlign: 'text-bottom'}} /> Profil
        </button>
        <button className={`profile-tab ${activeTab === 'recos' ? 'active' : ''}`} onClick={() => setActiveTab('recos')}>
          <Compass size={16} style={{marginRight: 6, verticalAlign: 'text-bottom'}} /> Recommandations
        </button>
        <button className={`profile-tab ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>
          <Bookmark size={16} style={{marginRight: 6, verticalAlign: 'text-bottom'}} /> Offres
        </button>
        <button className={`profile-tab ${activeTab === 'cvs' ? 'active' : ''}`} onClick={() => setActiveTab('cvs')}>
          <FileText size={16} style={{marginRight: 6, verticalAlign: 'text-bottom'}} /> CVs
        </button>
        <button className={`profile-tab ${activeTab === 'predictions' ? 'active' : ''}`} onClick={() => setActiveTab('predictions')}>
          <LineChart size={16} style={{marginRight: 6, verticalAlign: 'text-bottom'}} /> Prévisions
        </button>
        <button className={`profile-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <MessageCircle size={16} style={{marginRight: 6, verticalAlign: 'text-bottom'}} /> Jobly
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="profile-card">
          <div className="profile-info">
            <div className="profile-avatar">
              {session.user?.image ? (
                <img src={session.user.image} alt={session.user.name} />
              ) : (
                session.user?.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="profile-details">
              <h3>{session.user.name}</h3>
              <p>{session.user.email}</p>
            </div>
          </div>
          <div className="profile-stats" style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1, padding: '1.5rem', background: 'var(--surface-alt)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{data.jobs.length}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Offres sauvées</div>
            </div>
            <div style={{ flex: 1, padding: '1.5rem', background: 'var(--surface-alt)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{data.cvs.length}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>CVs générés</div>
            </div>
            <div style={{ flex: 1, padding: '1.5rem', background: 'var(--surface-alt)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)' }}>{data.recos.length}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Recommandations</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'recos' && (
        <div className="profile-list">
          {data.recos.length === 0 ? (
            <div className="profile-empty">Aucune recommandation sauvegardée.</div>
          ) : data.recos.map(item => (
            <div key={item._id} className="profile-item">
              <div className="profile-item-main">
                <div className="profile-item-title">
                  Recommandation pour {item.formData?.paysCible || 'Inconnu'}
                </div>
                <div className="profile-item-date">Sauvegardé le {new Date(item.createdAt).toLocaleDateString('fr-FR')}</div>
                <div className="profile-item-meta">
                  {item.results?.secteurs?.slice(0, 3).map(s => <span key={s} className="profile-tag">{s}</span>)}
                </div>
              </div>
              <div className="profile-item-actions">
                <button onClick={() => handleDeleteClick('recommendations', item._id)} className="btn-icon danger" title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="profile-list">
          {data.jobs.length === 0 ? (
            <div className="profile-empty">Aucune offre sauvegardée.</div>
          ) : data.jobs.map(item => (
            <div key={item._id} className="profile-item">
              <div className="profile-item-main">
                <div className="profile-item-title">
                  {item.titre}
                </div>
                <div className="profile-item-date">{item.entreprise} • {item.pays}</div>
                {item.salaire && <div style={{ fontSize: '0.85rem', color: 'var(--success)', marginTop: 4 }}>{item.salaire}</div>}
              </div>
              <div className="profile-item-actions">
                <a href={item.lien} target="_blank" rel="noopener noreferrer" className="btn-icon" title="Voir l'offre">
                  <ExternalLink size={16} />
                </a>
                <button onClick={() => handleDeleteClick('saved-jobs', item._id)} className="btn-icon danger" title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'cvs' && (
        <div className="profile-list">
          {data.cvs.length === 0 ? (
            <div className="profile-empty">Aucun CV généré.</div>
          ) : data.cvs.map(item => (
            <div key={item._id} className="profile-item">
              <div className="profile-item-main">
                <div className="profile-item-title">
                  CV : {item.nom} {item.prenom}
                </div>
                <div className="profile-item-date">Généré le {new Date(item.generatedAt).toLocaleDateString('fr-FR')}</div>
                <div className="profile-item-meta">
                  <span className="profile-tag">Template : {item.template}</span>
                </div>
              </div>
              <div className="profile-item-actions">
                <button onClick={() => handleDeleteClick('cvs', item._id)} className="btn-icon danger" title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="profile-list">
          {data.history.length === 0 ? (
            <div className="profile-empty">Aucun historique Jobly.</div>
          ) : data.history.map(item => (
            <div key={item._id} className="profile-item">
              <div className="profile-item-main">
                <div className="profile-item-title">
                  Session de Chat Jobly
                </div>
                <div className="profile-item-date">{new Date(item.sessionDate).toLocaleString('fr-FR')}</div>
                <div className="profile-item-meta">
                  <span className="profile-tag">Modèle : {item.model}</span>
                  <span className="profile-tag">{item.messages?.length || 0} messages</span>
                </div>
              </div>
              <div className="profile-item-actions">
                <button onClick={() => handleDeleteClick('jobly-history', item._id)} className="btn-icon danger" title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'predictions' && (
        <div className="profile-list">
          {data.predictions.length === 0 ? (
            <div className="profile-empty">Aucune prévision sauvegardée.</div>
          ) : data.predictions.map(item => (
            <div key={item._id} className="profile-item">
              <div className="profile-item-main">
                <div className="profile-item-title">
                  Prévision : {item.pays} {item.secteur ? `- ${item.secteur}` : ''}
                </div>
                <div className="profile-item-date">Sauvegardée le {new Date(item.createdAt).toLocaleDateString('fr-FR')}</div>
                <div className="profile-item-meta">
                  <span className="profile-tag">Période : {item.periode === 'quarterly' ? 'Trimestrielle' : 'Semestrielle'}</span>
                </div>
              </div>
              <div className="profile-item-actions">
                <button onClick={() => handleDeleteClick('predictions', item._id)} className="btn-icon danger" title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: 'var(--surface)', padding: '2rem', borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)', maxWidth: '400px', width: '90%', border: '1px solid var(--border)'
          }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}>
              <Trash2 size={20} color="var(--danger)" />
              Confirmer la suppression
            </h3>
            <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 2rem' }}>
              Êtes-vous sûr de vouloir supprimer définitivement cet élément ? Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={cancelDelete} style={{
                padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)', cursor: 'pointer'
              }}>
                Annuler
              </button>
              <button onClick={confirmDelete} style={{
                padding: '0.5rem 1rem', background: 'var(--danger)', border: 'none',
                borderRadius: 'var(--radius-sm)', color: 'white', cursor: 'pointer', fontWeight: 500
              }}>
                Oui, supprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
