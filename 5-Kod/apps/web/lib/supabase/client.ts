import { createBrowserSupabase } from '@corevo/auth'

/** Supabase client for Client Components (browser). */
export function createClient() {
  return createBrowserSupabase()
}
