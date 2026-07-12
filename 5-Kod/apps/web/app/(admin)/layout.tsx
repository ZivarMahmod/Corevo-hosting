import { requirePortal } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'
import { RealtimeBookings } from '@/components/realtime/RealtimeBookings'

export const dynamic = 'force-dynamic'

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
