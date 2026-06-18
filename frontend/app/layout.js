import './globals.css'
import LayoutShell from '@/components/LayoutShell'
import SessionProvider from '@/components/SessionProvider'

export const metadata = {
  title: 'Jobly — Prédiction Intelligente',
  description: 'Plateforme d\'analyse prédictive du marché du travail alimentée par l\'IA — Tableau de bord, prévisions et sentiment NLP',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <SessionProvider>
          <LayoutShell>{children}</LayoutShell>
        </SessionProvider>
      </body>
    </html>
  )
}
