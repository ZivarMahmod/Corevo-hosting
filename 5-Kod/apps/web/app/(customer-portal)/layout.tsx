import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './portal.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

// Manifestet länkas bara från den host-isolerade kundportalen. Ingen service
// worker registreras här: privata bokningar och profiluppgifter ska inte cacheas.
export const metadata: Metadata = {
  manifest: '/api/customer-portal/manifest',
  appleWebApp: {
    capable: true,
    title: 'Mina bokningar · Corevo',
    statusBarStyle: 'black-translucent',
  },
  icons: { apple: '/pwa/corevo-apple-touch-icon-180.png' },
}

export const viewport: Viewport = {
  themeColor: '#191a17',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function CustomerPortalLayout({ children }: { children: ReactNode }) {
  return children
}
