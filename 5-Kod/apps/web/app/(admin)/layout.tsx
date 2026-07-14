import type { Metadata, Viewport } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'
import { RealtimeBookings } from '@/components/realtime/RealtimeBookings'

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
  // Authorization fence for the whole portal. Re-checked in every mutating action
  // (RLS is tenant-scoped, NOT role-aware — see lib/admin/actions.ts).
  const user = await requirePortal('admin')
  // Nav now lives in the back-office sidebar (PortalShell → PortalSidebar,
  // role="admin"). The old in-content <AdminNav> is removed to avoid double nav.
  return (
    <PortalShell user={user} title="Adminpanel" world="backoffice" portal="admin">
      {/* Live-refresh bookings views on any write to this tenant's bookings.
          tenantId is the server-resolved JWT tenant; RLS fences the channel. */}
      <RealtimeBookings tenantId={user.tenantId ?? undefined} />
      {children}
    </PortalShell>
  )
}
