import { requirePortal } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'
import { AdminNav } from '@/components/admin/AdminNav'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Authorization fence for the whole portal. Re-checked in every mutating action
  // (RLS is tenant-scoped, NOT role-aware — see lib/admin/actions.ts).
  const user = await requirePortal('admin')
  return (
    <PortalShell user={user} title="Salongsadmin">
      <AdminNav />
      {children}
    </PortalShell>
  )
}
