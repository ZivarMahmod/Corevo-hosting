import 'server-only'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

// Service-role client for the ONE admin operation RLS can't do: creating an auth
// user (staff invite via auth.admin.*). Everything else in the admin revir goes
// through the authed cookie client + RLS. The key is server-only and must never
// reach the browser.
//
// Graceful degrade: SUPABASE_SERVICE_ROLE_KEY is empty in local/dev (mirrors the
// R2 + platform-invite pattern), so this returns null and the invite flow skips
// the auth-user creation with a clear message instead of throwing.

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

/** Service-role client (bypasses RLS, exposes auth.admin), or null if unconfigured. */
export function createAdminServiceClient(): SupabaseClient<Database> | null {
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) return null
  return createSupabaseClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
