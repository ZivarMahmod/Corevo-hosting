import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePlatformAdmin, type CurrentUser } from '@/lib/auth/session'

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
