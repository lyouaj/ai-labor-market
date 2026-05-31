'use client'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import JoblyChat from '@/components/JoblyChat'

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
      <JoblyChat />
    </div>
  )
}
