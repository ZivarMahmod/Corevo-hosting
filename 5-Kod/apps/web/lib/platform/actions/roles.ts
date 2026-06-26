'use server'

import { revalidatePath } from 'next/cache'
import { saveRolePermissions, type RolePermissionChange } from '../roles-permissions'
import { PERMISSION_AREAS, type Perm } from '../catalog-shared'
import { type ActionState } from './shared'

// ── goal-21: save the editable RBAC permission matrix ───────────────────────────
/**
 * Persist edited matrix cells. The platform_admin fence + the super_admin
 * self-lockout guard + the audit log live in saveRolePermissions (roles-permissions.ts,
 * server-only). This 'use server' wrapper just adapts the client payload (a JSON array
 * of {roleName, area, perm}) to that module call and revalidates the roller page.
 */
export async function saveRolePermissionsAction(
  changes: { roleName: string; area: string; perm: Perm }[],
): Promise<ActionState> {
  const safe = (Array.isArray(changes) ? changes : []).filter(
    (c): c is RolePermissionChange =>
      typeof c?.roleName === 'string' &&
      (PERMISSION_AREAS as readonly string[]).includes(c?.area) &&
      ((['full', 'own', 'view', '—'] as const) as readonly string[]).includes(c?.perm),
  )
  const res = await saveRolePermissions(safe)
  if (res.success) revalidatePath('/roller')
  return res
}
