import { requirePortal } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'
import { RealtimeBookings } from '@/components/realtime/RealtimeBookings'

export const dynamic = 'force-dynamic'

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
