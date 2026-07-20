import type { Metadata, Viewport } from 'next'
import { requirePlatformOperator } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'
import { RealtimeBookingsLazy } from '@/components/realtime/RealtimeBookingsLazy'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  manifest: '/api/pwa/platform-manifest',
  appleWebApp: { capable: true, title: 'Corevo Platform', statusBarStyle: 'black-translucent' },
  icons: { apple: '/pwa/admin-icon-180.png' },
}

export const viewport: Viewport = {
  themeColor: '#121210',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  // Strict DB-backed operator fence. Root gets global scope; a partner gets only
  // its own tenants through RLS + platformCtx. Tenant admins remain excluded.
  const user = await requirePlatformOperator()
  // PortalShell gives platform_admin the superadmin handoff top navigation while
  // tenant admin and staff keep their own sidebar shells.
  return (
    <PortalShell user={user} title="Plattform" world="backoffice" portal="platform">
      {/* No tenantId: the server resolves global vs partner scope. */}
      <RealtimeBookingsLazy />
      {children}
    </PortalShell>
  )
}
