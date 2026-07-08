import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePlatformAdmin, requirePortal, type CurrentUser } from '@/lib/auth/session'

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
}> {
  const user = await requirePlatformAdmin()
  const supabase = await createClient()
  return { user, supabase }
}

/**
 * Dual guard for the SIDA actions (storefront copy/images/branding/theme/contact/
 * opening hours/booking view/name) — the ONE set of actions shared between the
 * super-admin kundkort (/salonger/[id]) and the customer's own /admin/sida.
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
  const tenantId = user.platformAdmin
    ? String(fd.get('tenantId') ?? '')
    : (user.tenantId ?? '')
  return { user, supabase, tenantId }
}
