'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { LayoutDashboard, TrendingUp, Activity, Home, Compass, MessageCircle, FileText, Newspaper, UserCircle, LogOut, LogIn } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const links = [
    { name: 'Accueil', path: '/', icon: Home },
    { name: 'Aperçu', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Actualités', path: '/actualites', icon: Newspaper },
    { name: 'Recommandation', path: '/recommandation', icon: Compass },
    { name: 'CV Builder', path: '/cv-builder', icon: FileText },
    { name: 'Jobly Agent', path: '/jobly', icon: MessageCircle },
    { name: 'Prévisions', path: '/prediction', icon: TrendingUp },
  ]
  
  const { data: session } = useSession()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon"><Activity size={15} /></div>
        <div>
          <div className="sidebar-brand-text">Jobly</div>
          <div className="sidebar-brand-sub">Prédiction Intelligente</div>
        </div>
      </div>

      {session && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 600, overflow: 'hidden', flexShrink: 0 }}>
            {session.user?.image ? (
              <img src={session.user.image} alt={session.user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              session.user?.name?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{session.user.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{session.user.email}</div>
          </div>
        </div>
      )}

      <div className="sidebar-section-title" style={{ marginTop: session ? '1rem' : 0 }}>Menu</div>
      <nav className="sidebar-nav">
        {links.map(link => {
          const Icon = link.icon
          return (
            <Link key={link.path} href={link.path} className={`sidebar-link ${pathname === link.path ? 'active' : ''}`}>
              <Icon size={16} />{link.name}
            </Link>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        {session ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <Link href="/profile" className={`sidebar-link ${pathname === '/profile' ? 'active' : ''}`}>
              <UserCircle size={16} /> Mon Profil
            </Link>
            <button 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="sidebar-link" 
              style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--danger)' }}
            >
              <LogOut size={16} /> Se déconnecter
            </button>
          </div>
        ) : (
          <Link href="/login" className="sidebar-link" style={{ justifyContent: 'center', background: 'var(--accent)', color: 'var(--white)', fontWeight: 500 }}>
            <LogIn size={16} /> Se Connecter
          </Link>
        )}
      </div>
    </aside>
  )
}
