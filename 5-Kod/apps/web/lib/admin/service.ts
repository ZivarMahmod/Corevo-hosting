import 'server-only'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

// Service-role client for tightly scoped server operations RLS must not expose to
// a browser session: auth-user invites and Stripe-owned readiness/billing fields.
// Ordinary admin CRUD still goes through the authenticated cookie client + RLS.
// The key is server-only and must never reach the browser.
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
