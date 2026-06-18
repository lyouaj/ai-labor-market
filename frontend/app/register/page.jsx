'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Activity, User, Mail, Lock, ArrowRight, Globe } from 'lucide-react'

export default function Register() {
  const router = useRouter()
  const [data, setData] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (data.password !== data.confirm) {
      return setError('Les mots de passe ne correspondent pas.')
    }
    if (data.password.length < 8) {
      return setError('Le mot de passe doit faire au moins 8 caractères.')
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, email: data.email, password: data.password })
      })
      
      const resData = await res.json()

      if (!res.ok) {
        setError(resData.error || 'Erreur lors de l\'inscription.')
      } else {
        // Auto login after register
        await signIn('credentials', {
          email: data.email,
          password: data.password,
          callbackUrl: '/dashboard'
        })
      }
    } catch (err) {
      setError('Erreur de connexion au serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="landing-logo-icon" style={{ margin: '0 auto 16px', width: 40, height: 40 }}>
            <Activity size={20} />
          </div>
          <h2>Créer un compte</h2>
          <p>Rejoignez Jobly pour sauvegarder vos données.</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Nom complet</label>
            <div className="auth-input-wrap">
              <User size={16} />
              <input 
                type="text" 
                required 
                value={data.name}
                onChange={e => setData({...data, name: e.target.value})}
                placeholder="John Doe"
              />
            </div>
          </div>

          <div className="auth-field">
            <label>Adresse Email</label>
            <div className="auth-input-wrap">
              <Mail size={16} />
              <input 
                type="email" 
                required 
                value={data.email}
                onChange={e => setData({...data, email: e.target.value})}
                placeholder="vous@exemple.com"
              />
            </div>
          </div>

          <div className="auth-field">
            <label>Mot de Passe</label>
            <div className="auth-input-wrap">
              <Lock size={16} />
              <input 
                type="password" 
                required 
                value={data.password}
                onChange={e => setData({...data, password: e.target.value})}
                placeholder="•••••••• (min 8)"
              />
            </div>
          </div>

          <div className="auth-field">
            <label>Confirmer Mot de Passe</label>
            <div className="auth-input-wrap">
              <Lock size={16} />
              <input 
                type="password" 
                required 
                value={data.confirm}
                onChange={e => setData({...data, confirm: e.target.value})}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button type="submit" className="auth-btn primary" disabled={loading}>
            {loading ? 'Création...' : 'Créer mon compte'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="auth-divider">
          <span>OU</span>
        </div>

        <button 
          className="auth-btn secondary"
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        >
          <Globe size={16} />
          S'inscrire avec Google
        </button>

        <div className="auth-footer">
          Déjà un compte ? <Link href="/login">Connectez-vous</Link>
        </div>
      </div>
    </div>
  )
}
