import { cookies } from 'next/headers'
import { createServerSupabase } from '@corevo/auth'

/** Supabase client for Server Components, Route Handlers, and Server Actions. */
export async function createClient() {
  const cookieStore = await cookies()
  return createServerSupabase({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => {
      try {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options)
        }
      } catch {
        // Called from a Server Component (read-only cookies). Safe to ignore —
        // the middleware refreshes the session and writes cookies on responses.
      }
    },
  })
}
