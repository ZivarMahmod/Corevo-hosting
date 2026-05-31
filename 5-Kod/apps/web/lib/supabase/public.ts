import { createClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

/**
 * Anonymous, cookie-less Supabase client for PUBLIC reads (white-label site).
 *
 * No cookies → safe to call inside `unstable_cache` (unlike the cookie-based
 * server client). Always runs as the `anon` role, gated by the public-read RLS
 * policies in migration 0004. Tenant isolation is enforced in the app layer via
 * `.eq('tenant_id', …)` — anon carries no tenant claim (see 0004 header).
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
