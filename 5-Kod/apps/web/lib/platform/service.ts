import 'server-only'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

// Service-role client for the ONE platform operation RLS can't do: creating an
// auth user (salon_admin invite via auth.admin.*). Everything else goes through
// the authed platform_admin cookie client + RLS bypass — NOT this. The key is
// server-only and must never reach the browser.
//
// Graceful degrade: SUPABASE_SERVICE_ROLE_KEY is empty in local/dev (mirrors the
// R2 pattern), so this returns null and the create-tenant flow skips the invite
// with a clear message instead of throwing.

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

/** True when a service-role client can be built (invite path is available). */
export function hasServiceRole(): boolean {
  return Boolean(SERVICE_ROLE_KEY && SUPABASE_URL)
}

/** Service-role client (bypasses RLS, exposes auth.admin), or null if unconfigured. */
export function createServiceClient(): SupabaseClient<Database> | null {
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) return null
  return createSupabaseClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
