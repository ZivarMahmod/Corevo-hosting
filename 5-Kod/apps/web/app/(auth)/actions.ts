'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { portalHomeFor } from '@/lib/auth/roles'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'

export type SignInState = { error?: string }

/**
 * Sign in with email + password (Supabase Auth). On success, redirect to the
 * originally requested page (`next`) or the role-appropriate portal home.
 * Wrong credentials get a single friendly message (no user-enumeration).
 */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '')

  if (!email || !password) return { error: 'Fyll i både e-post och lösenord.' }

  // Rate-limit by IP (G10) — slows credential-stuffing. App-layer complement to
  // the Cloudflare WAF rule (primary, documented in ops). Fails open on DB error.
  const ip = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('login', ip), LIMITS.login))) {
    return { error: 'För många inloggningsförsök. Vänta en stund och försök igen.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return { error: 'Fel e-post eller lösenord. Försök igen.' }
  }

  if (next && next.startsWith('/')) redirect(next)

  // Role level from the just-authenticated client (RLS: own row + role).
  const platformAdmin = (data.user.app_metadata as { platform_admin?: boolean })?.platform_admin === true
  let roleLevel = 0
  const { data: profile } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profile?.role_id) {
    const { data: role } = await supabase
      .from('roles')
      .select('level')
      .eq('id', profile.role_id)
      .maybeSingle()
    roleLevel = role?.level ?? 0
  }

  redirect(portalHomeFor({ roleLevel, platformAdmin }))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
