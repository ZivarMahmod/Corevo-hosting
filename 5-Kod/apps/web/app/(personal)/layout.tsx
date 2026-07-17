import type { Metadata, Viewport } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { RealtimeBookingsLazy } from '@/components/realtime/RealtimeBookingsLazy'
import { PersonalPwaShell } from '@/components/personal/PersonalPwaShell'

export const dynamic = 'force-dynamic'

// PWA: gör personal-portalen installerbar på hemskärmen (Zivar 2026-07-11:
// "som en enkel kalender de snabbt kan öppna på telefonen"). Manifestet länkas
// bara här — aldrig globalt, annars blir storefronts installerbara som appen.
export const metadata: Metadata = {
  manifest: '/api/pwa/personal-manifest',
  appleWebApp: { capable: true, title: 'Corevo Personal', statusBarStyle: 'black-translucent' },
  // iPhone läser inte manifest-ikoner — hemskärmen kräver apple-touch-icon (PNG).
  icons: { apple: '/pwa/personal-icon-180.png' },
}
export const viewport: Viewport = { themeColor: '#121210' }

export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal('personal')
  return (
    <PersonalPwaShell>
      <RealtimeBookingsLazy tenantId={user.tenantId ?? undefined} />
      {children}
    </PersonalPwaShell>
  )
}
