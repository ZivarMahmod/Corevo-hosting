import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

/**
 * Service-role Supabase client — SERVER-ONLY, bypasses RLS.
 *
 * Used only after a server action has established the caller's identity and
 * resource ownership: auth bootstrap plus customer cancel/rebook writes whose
 * cutoff/refund/notification flow must not be exposed as raw PostgREST UPDATE.
 * A fresh signup's role is hard-pinned to `kund`; booking ids are resolved from
 * the signed-in customer's own RLS-scoped reads before this client is created.
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
