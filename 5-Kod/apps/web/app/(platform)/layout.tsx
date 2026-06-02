import { requirePlatformAdmin } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  // Strict role fence: platform_admin only. Re-checked in every server action
  // (platformCtx). A salon_admin (level 6) is redirected to /ingen-atkomst.
  const user = await requirePlatformAdmin()
  // Nav now lives in the back-office sidebar (PortalShell → PortalSidebar,
  // role="platform"). The old in-content <PlatformNav> is removed.
  return (
    <PortalShell user={user} title="Plattform" world="backoffice" portal="platform">
      {children}
    </PortalShell>
  )
}
