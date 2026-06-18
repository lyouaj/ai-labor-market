'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Activity, Mail, Lock, ArrowRight, Globe } from 'lucide-react'

export default function Login() {
  const router = useRouter()
  const [data, setData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const res = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false
      })

      if (res?.error) {
        setError('Email ou mot de passe incorrect')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError('Une erreur est survenue.')
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
          <h2>Bon retour</h2>
          <p>Connectez-vous pour accéder à vos données sauvegardées.</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
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
                placeholder="••••••••"
              />
            </div>
          </div>

          <button type="submit" className="auth-btn primary" disabled={loading}>
            {loading ? 'Connexion...' : 'Se Connecter'}
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
          Continuer avec Google
        </button>

        <div className="auth-footer">
          Pas encore de compte ? <Link href="/register">Inscrivez-vous</Link>
        </div>
      </div>
    </div>
  )
}
