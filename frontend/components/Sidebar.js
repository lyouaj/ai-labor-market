'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, TrendingUp, Activity, Home, Compass, MessageCircle, FileText, Newspaper } from 'lucide-react'

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
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon"><Activity size={15} /></div>
        <div>
          <div className="sidebar-brand-text">IA Travail</div>
          <div className="sidebar-brand-sub">Intelligence du Marché</div>
        </div>
      </div>
      <div className="sidebar-section-title">Menu</div>
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
    </aside>
  )
}
