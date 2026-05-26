import './globals.css'
import LayoutShell from '@/components/LayoutShell'

export const metadata = {
  title: 'IA Travail — Intelligence du Marché',
  description: 'Plateforme d\'analyse prédictive du marché du travail alimentée par l\'IA — Tableau de bord, prévisions et sentiment NLP',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}
