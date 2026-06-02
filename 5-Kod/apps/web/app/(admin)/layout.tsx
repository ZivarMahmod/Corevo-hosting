import { requirePortal } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Authorization fence for the whole portal. Re-checked in every mutating action
  // (RLS is tenant-scoped, NOT role-aware — see lib/admin/actions.ts).
  const user = await requirePortal('admin')
  // Nav now lives in the back-office sidebar (PortalShell → PortalSidebar,
  // role="admin"). The old in-content <AdminNav> is removed to avoid double nav.
  return (
    <PortalShell user={user} title="Salongsadmin" world="backoffice" portal="admin">
      {children}
    </PortalShell>
  )
}
