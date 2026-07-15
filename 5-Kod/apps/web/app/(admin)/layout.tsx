import type { Metadata, Viewport } from 'next'
import { requireMinLevel } from '@/lib/auth/session'
import { ADMIN_PORTAL_FLOOR } from '@/lib/auth/admin-areas'
import { PortalShell } from '@/components/portal/PortalShell'
import { RealtimeBookingsLazy } from '@/components/realtime/RealtimeBookingsLazy'

export const dynamic = 'force-dynamic'

// PWA: salongen står med en iPad i receptionen hela dagen. Sparad på hemskärmen ska
// adminen öppna som en APP — inget adressfält, inga flikar, direkt i dagens kalender.
// Manifestet länkas BARA här, aldrig globalt (annars blir varje storefront
// installerbar som adminappen). Samma mönster som personal-portalen.
export const metadata: Metadata = {
  manifest: '/api/pwa/admin-manifest',
  appleWebApp: { capable: true, title: 'Corevo', statusBarStyle: 'default' },
  // iPhone/iPad läser inte manifest-ikoner — hemskärmen kräver apple-touch-icon (PNG).
  icons: { apple: '/pwa/admin-icon-180.png' },
}
export const viewport: Viewport = {
  themeColor: '#26261f',
  // Appkänsla på surfplatta: layouten fyller skärmen och kalendern äger sin egen
  // scroll, så sidan ska aldrig studsa som ett webbdokument.
  width: 'device-width',
  initialScale: 1,
  // viewportFit: appen ritas ut i hela skärmen; safe-area-insets håller knappar
  // borta från hemknappsremsan (modal.module.css använder env(safe-area-inset-*)).
  viewportFit: 'cover',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Portalens GOLV, inte hela grinden. Personal (nivå 3) släpps in i portalen —
  // varje sida gatar sedan SIN yta via requireAdminArea (lib/auth/admin-areas.ts),
  // och varje muterande action gör om samma kontroll (RLS är tenant-scopad, INTE
  // rollmedveten — se lib/admin/actions.ts).
  const user = await requireMinLevel(ADMIN_PORTAL_FLOOR)
  // Nav now lives in the back-office sidebar (PortalShell → PortalSidebar,
  // role="admin"). The old in-content <AdminNav> is removed to avoid double nav.
  return (
    <PortalShell user={user} title="Adminpanel" world="backoffice" portal="admin">
      {/* Live-refresh bookings views on any write to this tenant's bookings.
          tenantId is the server-resolved JWT tenant; RLS fences the channel. */}
      <RealtimeBookingsLazy tenantId={user.tenantId ?? undefined} />
      {children}
    </PortalShell>
  )
}
