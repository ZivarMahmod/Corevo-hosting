import { requirePlatformAdmin } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'
import { PlatformNav } from '@/components/platform/PlatformNav'

export const dynamic = 'force-dynamic'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  // Strict role fence: platform_admin only. Re-checked in every server action
  // (platformCtx). A salon_admin (level 6) is redirected to /ingen-atkomst.
  const user = await requirePlatformAdmin()
  return (
    <PortalShell user={user} title="Plattform">
      <PlatformNav />
      {children}
    </PortalShell>
  )
}
