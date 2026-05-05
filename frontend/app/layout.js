import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata = {
  title: 'IA Travail — Intelligence du Marché',
  description: 'Tableau de bord analytique du marché du travail alimenté par l\'IA avec prévisions',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <Sidebar />
          <main className="main-area">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
