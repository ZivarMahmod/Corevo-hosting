import { requirePlatformAdmin } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformAdmin()
  return (
    <PortalShell user={user} title="Plattform">
      {children}
    </PortalShell>
  )
}
