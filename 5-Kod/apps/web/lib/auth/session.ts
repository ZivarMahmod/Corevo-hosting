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
import type { AdminArea } from '@/lib/auth/admin-areas'
import { hasAdminAreaPermission } from '@/lib/admin/member-permissions'
import { logAuthDenied } from '@/lib/observability'
import {
  isRejectedPartnerIdentity,
  resolvePlatformIdentity,
} from '@/lib/auth/platform-identity'

export type CurrentUser = {
  id: string
  email: string | null
  /** Visningsnamn ur auth user_metadata (full_name/name), null när inget satt.
   *  Kosmetiskt (hälsningar) — aldrig en behörighetssignal. */
  name: string | null
  tenantId: string | null
  staffId: string | null
  platformAdmin: boolean
  partnerAdmin: boolean
  partnerId: string | null
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
  // PLAN 011: getClaims() i stället för getUser() — verifierar JWT-signaturen
  // LOKALT (asymmetriska nycklar aktiva) i stället för en GoTrue-nätverksrunda
  // per render. Allt DAL:en behöver (sub/email/app_metadata/user_metadata) finns
  // i claims; refresh-punkten bor kvar i middleware (lib/supabase/middleware.ts).
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  const userId = claims.sub
  const userEmail = (claims.email as string | undefined) ?? null

  const appMeta = (claims.app_metadata ?? {}) as { tenant_id?: string; platform_admin?: boolean }
  const userMeta = (claims.user_metadata ?? {}) as { full_name?: string; name?: string }
  const name = userMeta.full_name?.trim() || userMeta.name?.trim() || null

  // Prestanda C3: rollnivån hämtas via en FK-embed (users.role_id → roles) i STÄLLET
  // för en andra seriell round-trip till `roles`. Samma RLS-väg som förut (användaren
  // läser sin egen users-rad + sin roll). PostgREST returnerar en to-one-relation som
  // objekt; vi normaliserar defensivt ifall klienten typar den som array.
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role_id, status, roles:role_id(level, name, tenant_id)')
    .eq('id', userId)
    .maybeSingle()

  const roleEmbed = (profile as { roles?: unknown } | null)?.roles
  const role = (Array.isArray(roleEmbed) ? roleEmbed[0] : roleEmbed) as
    | { level: number; name: string | null; tenant_id: string | null }
    | null
    | undefined

  // Lös den aktiva personalraden för ALLA tenantroller. En ägare kan också arbeta i
  // verksamheten och ska då få sin riktiga personalprofil, samtidigt som bara den
  // rena staffrollen blir obehörig om länken saknas eller har inaktiverats.
  let activeStaff: { id: string } | null = null
  if (profile?.status === 'active' && profile.tenant_id) {
    const { data } = await supabase
      .from('staff')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('profile_id', userId)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    activeStaff = data
  }
  const accountAuthorized =
    profile?.status === 'active' && (role?.level !== 3 || Boolean(activeStaff))
  const roleLevel = accountAuthorized ? (role?.level ?? 0) : 0
  const roleName = accountAuthorized ? (role?.name ?? null) : null

  // Partner JWT claims are only routing hints. Authorization is re-resolved from
  // the live membership and partner rows so suspending either takes effect even
  // while an older token is still valid.
  let membership: {
    partnerId: string
    memberStatus: string | null
    partnerStatus: string | null
  } | null = null
  if (
    accountAuthorized &&
    role?.tenant_id === null &&
    roleName === 'partner_admin' &&
    roleLevel === 7
  ) {
    const { data: member } = await supabase
      .from('partner_members')
      .select('partner_id, status, partners:partner_id(status)')
      .eq('user_id', userId)
      .maybeSingle()
    const partnerEmbed = (member as { partners?: unknown } | null)?.partners
    const partner = (Array.isArray(partnerEmbed) ? partnerEmbed[0] : partnerEmbed) as
      | { status: string | null }
      | null
      | undefined
    if (member?.partner_id) {
      membership = {
        partnerId: member.partner_id,
        memberStatus: member.status,
        partnerStatus: partner?.status ?? null,
      }
    }
  }

  const platformIdentity = resolvePlatformIdentity({
    accountAuthorized,
    roleLevel,
    roleName,
    roleTenantId: role?.tenant_id ?? null,
    appPlatformAdmin: appMeta.platform_admin === true,
    membership,
  })
  const rejectedPartner = isRejectedPartnerIdentity({
    accountAuthorized,
    roleLevel,
    roleName,
    roleTenantId: role?.tenant_id ?? null,
    partnerAdmin: platformIdentity.partnerAdmin,
  })

  return {
    id: userId,
    email: userEmail,
    name,
    tenantId: profile ? profile.tenant_id : (appMeta.tenant_id ?? null),
    staffId: activeStaff?.id ?? null,
    ...platformIdentity,
    roleLevel: rejectedPartner ? 0 : roleLevel,
    roleName: rejectedPartner ? null : roleName,
  }
})

/** Require a logged-in user; otherwise bounce to login (preserving the target). */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : '/login')
  return user
}

/** Require at least `minLevel` (verified platform operators always pass). */
export async function requireMinLevel(minLevel: number): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.platformAdmin || user.partnerAdmin) return user
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
  if (!(await hasAdminAreaPermission(area, user))) {
    logAuthDenied({ userId: user.id, roleLevel: user.roleLevel, need: `admin:${area}` })
    redirect('/ingen-atkomst')
  }
  return user
}

/** Kräv minst EN av flera namngivna adminytor. Används när en gemensam
 * detaljsida visar olika, separat gatade delar — exempelvis personkortets
 * ägaradministration och platschefens schemaredigering. Mutationerna behåller
 * alltid sina egna enskilda area-grindar. */
export async function requireAnyAdminArea(areas: readonly AdminArea[]): Promise<CurrentUser> {
  const user = await requireUser()
  const decisions = await Promise.all(areas.map((area) => hasAdminAreaPermission(area, user)))
  if (!decisions.some(Boolean)) {
    logAuthDenied({
      userId: user.id,
      roleLevel: user.roleLevel,
      need: `admin:any(${areas.join('|')})`,
    })
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

/** Require either global superadmin or a live, DB-verified partner operator. */
export async function requirePlatformOperator(): Promise<CurrentUser> {
  const user = await requireUser()
  if (!user.platformAdmin && !(user.partnerAdmin && user.partnerId)) {
    logAuthDenied({ userId: user.id, roleLevel: user.roleLevel, need: 'platform_operator' })
    redirect('/ingen-atkomst')
  }
  return user
}
