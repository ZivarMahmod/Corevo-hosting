import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

/**
 * Service-role Supabase client — SERVER-ONLY, bypasses RLS.
 *
 * Used solely to bootstrap a customer at signup: the auth.users record (with the
 * tenant_id baked into app_metadata) and the matching public.users row. A fresh
 * signup's JWT carries no tenant_id claim yet, so a normal authenticated INSERT
 * into public.users would fail the `tenant_id = private.tenant_id()` RLS check —
 * hence the privileged bootstrap (same reason the SQL seed sets app_metadata by
 * hand). Role is always hard-pinned to `kund` by the caller, so this can never
 * escalate privileges.
 *
 * Instantiated lazily INSIDE the action (never at module scope) so the key is
 * not evaluated or bundled at build time. NEVER import into a Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
