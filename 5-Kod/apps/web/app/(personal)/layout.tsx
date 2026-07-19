import type { Metadata, Viewport } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { RealtimeBookingsLazy } from '@/components/realtime/RealtimeBookingsLazy'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

// PWA: gör personal-portalen installerbar på hemskärmen (Zivar 2026-07-11:
// "som en enkel kalender de snabbt kan öppna på telefonen"). Manifestet länkas
// bara här — aldrig globalt, annars blir storefronts installerbara som appen.
export const metadata: Metadata = {
  manifest: '/api/pwa/personal-manifest',
  appleWebApp: { capable: true, title: 'Corevo Personal', statusBarStyle: 'default' },
  // iPhone läser inte manifest-ikoner — hemskärmen kräver apple-touch-icon (PNG).
  icons: { apple: '/pwa/personal-icon-180.png' },
}
// Samma statusfältsfärg som kund-adminen (#26261f) — personal-portalen delar nu
// exakt samma back-office-skal (PortalShell), så statusfältet ska matcha.
export const viewport: Viewport = {
  themeColor: '#26261f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  // Personal-portalen renderar genom SAMMA PortalShell-väg som kund-adminen
  // (portal="personal" → TOPNAV-grenen med bottenflik-mobilnav). requirePortal
  // gatar portalen; varje sida gör om sin egen requirePortal('personal').
  const user = await requirePortal('personal')
  return (
    <PortalShell user={user} title="Personal" world="backoffice" portal="personal">
      <RealtimeBookingsLazy tenantId={user.tenantId ?? undefined} />
      {children}
    </PortalShell>
  )
}
