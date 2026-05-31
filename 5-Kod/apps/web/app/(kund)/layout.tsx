import { requirePortal } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

export default async function KundLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal('kund')
  return (
    <PortalShell user={user} title="Mitt konto">
      {children}
    </PortalShell>
  )
}
