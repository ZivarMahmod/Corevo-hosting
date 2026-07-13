import { requirePlatformAdmin } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'
import { RealtimeBookings } from '@/components/realtime/RealtimeBookings'

export const dynamic = 'force-dynamic'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  // Strict role fence: platform_admin only. Re-checked in every server action
  // (platformCtx). A salon_admin (level 6) is redirected to /ingen-atkomst.
  const user = await requirePlatformAdmin()
  // PortalShell gives platform_admin the superadmin handoff top navigation while
  // tenant admin and staff keep their own sidebar shells.
  return (
    <PortalShell user={user} title="Plattform" world="backoffice" portal="platform">
      {/* No tenantId: platform_admin is cross-tenant by design. RLS still fences
          the channel to is_platform_admin(). */}
      <RealtimeBookings />
      {children}
    </PortalShell>
  )
}
