import type { Metadata, Viewport } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'
import { RealtimeBookings } from '@/components/realtime/RealtimeBookings'

export const dynamic = 'force-dynamic'

// PWA: gör personal-portalen installerbar på hemskärmen (Zivar 2026-07-11:
// "som en enkel kalender de snabbt kan öppna på telefonen"). Manifestet länkas
// bara här — aldrig globalt, annars blir storefronts installerbara som appen.
export const metadata: Metadata = {
  manifest: '/api/pwa/personal-manifest',
  appleWebApp: { capable: true, title: 'Min bokning', statusBarStyle: 'default' },
  // iPhone läser inte manifest-ikoner — hemskärmen kräver apple-touch-icon (PNG).
  icons: { apple: '/pwa/personal-icon-180.png' },
}
export const viewport: Viewport = { themeColor: '#1F4636' }

export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal('personal')
  // Nav now lives in the back-office sidebar (PortalShell → PortalSidebar,
  // role="personal"). The old in-content <PersonalNav> is removed.
  return (
    <PortalShell user={user} title="Personal" world="backoffice" portal="personal">
      {/* Live-refresh the staff member's own bookings views; RLS fences the channel
          to this tenant (tenantId is the server-resolved JWT tenant). */}
      <RealtimeBookings tenantId={user.tenantId ?? undefined} />
      {children}
    </PortalShell>
  )
}
