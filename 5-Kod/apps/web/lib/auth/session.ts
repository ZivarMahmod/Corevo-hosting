// Shared auth helpers reused by every portal (kund / personal / admin / platform).
// The authoritative authorization fence lives HERE (Data Access Layer) and inside
// server actions — NOT in middleware, which only does a cheap "logged in?" gate
// (see lib/supabase/middleware.ts). Layouts are not a security boundary on their
// own; always re-check in the action that mutates data.
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PORTAL_MIN_LEVEL, type Portal } from '@/lib/auth/roles'
import { canAccessAdminArea, type AdminArea } from '@/lib/auth/admin-areas'
import { logAuthDenied } from '@/lib/observability'

export type CurrentUser = {
  id: string
  email: string | null
  tenantId: string | null
  platformAdmin: boolean
  roleLevel: number
  roleName: string | null
}

/**
 * The current authenticated user + resolved role level, or null. `cache()` dedupes
 * the Supabase round-trip across a single server render. Reads app_metadata from
 * the verified JWT (tenant_id / platform_admin) and the role level from the DB
 * (RLS lets a user read their own users row + role).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const appMeta = (user.app_metadata ?? {}) as { tenant_id?: string; platform_admin?: boolean }

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role_id')
    .eq('id', user.id)
    .maybeSingle()

  let roleLevel = 0
  let roleName: string | null = null
  if (profile?.role_id) {
    const { data: role } = await supabase
      .from('roles')
      .select('level, name')
      .eq('id', profile.role_id)
      .maybeSingle()
    if (role) {
      roleLevel = role.level
      roleName = role.name
    }
  }

  return {
    id: user.id,
    email: user.email ?? null,
    tenantId: appMeta.tenant_id ?? profile?.tenant_id ?? null,
    platformAdmin: appMeta.platform_admin === true,
    roleLevel,
    roleName,
  }
})

/** Require a logged-in user; otherwise bounce to login (preserving the target). */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : '/login')
  return user
}

/** Require at least `minLevel` (platform_admin always passes). */
export async function requireMinLevel(minLevel: number): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.platformAdmin) return user
  if (user.roleLevel < minLevel) redirect('/ingen-atkomst')
  return user
}

/** Convenience: require the minimum level for a named portal. */
export async function requirePortal(portal: Portal): Promise<CurrentUser> {
  return requireMinLevel(PORTAL_MIN_LEVEL[portal])
}

/**
 * ROLL-SEPARATION: kräv behörighet för en NAMNGIVEN admin-yta (lib/auth/admin-areas.ts).
 * Adminportalens layout släpper in redan från staff-nivån (ADMIN_PORTAL_FLOOR) — det är
 * HÄR, och i varje muterande server action, ytan faktiskt gatas. RLS är tenant-scopad,
 * inte rollmedveten: en action utan den här vakten är öppen för personalen.
 */
export async function requireAdminArea(area: AdminArea): Promise<CurrentUser> {
  const user = await requireUser()
  if (!canAccessAdminArea(area, user)) {
    logAuthDenied({ userId: user.id, roleLevel: user.roleLevel, need: `admin:${area}` })
    redirect('/ingen-atkomst')
  }
  return user
}

/** Require the global platform_admin flag (cross-tenant). */
export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser()
  if (!user.platformAdmin) {
    // goal-44 Spår A: log the cross-tenant denial BEFORE the redirect throws
    // (never wrap NEXT_REDIRECT). uuid + level only — no email/name (PII).
    logAuthDenied({ userId: user.id, roleLevel: user.roleLevel, need: 'platform_admin' })
    redirect('/ingen-atkomst')
  }
  return user
}
