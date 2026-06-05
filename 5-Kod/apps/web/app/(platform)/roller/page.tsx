import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { getPlatformRoles } from '@/lib/platform/catalog'
import { PageHead } from '@/components/portal/ui'
import { RolesMatrix } from '@/components/platform/RolesMatrix'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Roller & behörighet' }

/**
 * Roller & behörighet (goal-17 PLATFORM, goal-21 RBAC). Layout = EXACT copy of the
 * design-system law source (components/SuperPlatform.jsx → SuperRoles): role list +
 * permission matrix. goal-21 made the matrix a LIVE editor: cells read from
 * role_permissions (DB) with a code DEFAULT_ROLE_CATALOG fallback, edits persist via
 * saveRolePermissions (platform_admin-gated), and super_admin stays locked at full.
 * The cross-tenant user count per role is bound via getPlatformRoles() (RLS-bypass)
 * with honest "—" where no seeded DB role backs a count.
 */
export default async function RollerPage() {
  // Strict role fence — also enforced by the (platform) layout and by
  // getPlatformRoles() → platformCtx(); kept explicit per goal-17 self-gate rule.
  await requirePlatformAdmin()
  const roles = await getPlatformRoles()

  return (
    <section className="portal-section">
      <PageHead
        eyebrow="Plattform"
        title="Roller & behörighet"
        lede="Minsta möjliga behörighet (least privilege). private.tenant_id() isolerar tenant-data — ägaren ser aldrig en annan salongs rader."
      />
      <RolesMatrix roles={roles} />
    </section>
  )
}
