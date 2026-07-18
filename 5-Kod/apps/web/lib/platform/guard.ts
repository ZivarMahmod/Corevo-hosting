import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  requirePlatformAdmin,
  requirePlatformOperator,
  requirePortal,
  type CurrentUser,
} from '@/lib/auth/session'

export type PlatformScope =
  | { kind: 'global'; partnerId: null }
  | { kind: 'partner'; partnerId: string }

export class PlatformScopeError extends Error {
  constructor() {
    super('Tenant is outside the verified platform scope')
    this.name = 'PlatformScopeError'
  }
}

export function platformScopeFor(user: CurrentUser): PlatformScope {
  if (user.platformAdmin) return { kind: 'global', partnerId: null }
  if (user.partnerAdmin && user.partnerId) {
    return { kind: 'partner', partnerId: user.partnerId }
  }
  throw new PlatformScopeError()
}

/**
 * Authorization fence for EVERY platform mutation/read that crosses tenants.
 * RLS grants cross-tenant access via the baked `platform_admin` JWT claim
 * (private.is_platform_admin()), but RLS is not the role gate — this is. The
 * authed cookie client carries the platform admin's JWT, so its reads/writes
 * bypass tenant isolation only because that claim is present.
 */
export async function platformCtx(): Promise<{
  user: CurrentUser
  supabase: Awaited<ReturnType<typeof createClient>>
  scope: PlatformScope
}> {
  const user = await requirePlatformOperator()
  const supabase = await createClient()
  return { user, supabase, scope: platformScopeFor(user) }
}

/** Exact root-only context for global Corevo configuration and role management. */
export async function platformAdminCtx(): Promise<{
  user: CurrentUser
  supabase: Awaited<ReturnType<typeof createClient>>
  scope: { kind: 'global'; partnerId: null }
}> {
  const user = await requirePlatformAdmin()
  const supabase = await createClient()
  return { user, supabase, scope: { kind: 'global', partnerId: null } }
}

export async function assertPlatformTenantAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
): Promise<void> {
  if (!tenantId) throw new PlatformScopeError()
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .maybeSingle()
  // The cookie client's RLS is the authoritative scope filter. A foreign
  // partner tenant and a missing tenant intentionally have the same result.
  if (error || !data) throw new PlatformScopeError()
}

/**
 * Dual guard for the SIDA actions (storefront copy/images/branding/theme/contact/
 * opening hours/booking view/name) — the ONE set of actions shared between the
 * super-admin kundkort (/kunder/[id]) and the customer's own /admin/sida.
 *
 * Trust model: a platform admin edits ANY tenant, so tenantId comes from the form
 * (validated server-side by each action's tenant read). A salon admin (role level
 * ≥ admin portal) may ONLY edit their own tenant, so tenantId is FORCED from the
 * verified JWT — whatever the client posted is ignored. RLS (private.tenant_id())
 * is the second fence, but reads/error messages never rely on it alone.
 */
export async function sidaCtx(fd: FormData): Promise<{
  user: CurrentUser
  supabase: Awaited<ReturnType<typeof createClient>>
  tenantId: string
}> {
  const user = await requirePortal('admin') // platform_admin always passes
  const supabase = await createClient()
  const isPlatformOperator = user.platformAdmin || user.partnerAdmin
  const tenantId = isPlatformOperator
    ? String(fd.get('tenantId') ?? '')
    : (user.tenantId ?? '')
  if (isPlatformOperator) await assertPlatformTenantAccess(supabase, tenantId)
  return { user, supabase, tenantId }
}

/** Object-input twin of sidaCtx for the snapshot editor server actions.
 * Platform admins may choose a tenant; salon admins are always forced back to
 * the tenant id in their verified session, regardless of client input. */
export async function siteRevisionCtx(input: { tenantId?: string | null }): Promise<{
  user: CurrentUser
  supabase: Awaited<ReturnType<typeof createClient>>
  tenantId: string
}> {
  const user = await requirePortal('admin')
  const supabase = await createClient()
  const isPlatformOperator = user.platformAdmin || user.partnerAdmin
  const tenantId = isPlatformOperator
    ? String(input.tenantId ?? '')
    : (user.tenantId ?? '')
  if (isPlatformOperator) await assertPlatformTenantAccess(supabase, tenantId)
  return { user, supabase, tenantId }
}
