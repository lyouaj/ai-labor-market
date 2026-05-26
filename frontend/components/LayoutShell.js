'use client'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function LayoutShell({ children }) {
  const pathname = usePathname()
  const isLanding = pathname === '/'
  
  if (isLanding) {
    return <>{children}</>
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-area">
        {children}
      </main>
    </div>
  )
}
