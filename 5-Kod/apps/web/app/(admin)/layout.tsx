import { requirePortal } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal('admin')
  return (
    <PortalShell user={user} title="Salongsadmin">
      {children}
    </PortalShell>
  )
}
