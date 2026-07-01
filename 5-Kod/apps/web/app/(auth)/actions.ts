'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { portalHomeFor, backofficeHostKindForRole } from '@/lib/auth/roles'
import {
  getTenantFromHost,
  isPreviewHost,
  getSuperadminHost,
  getPlatformHost,
  getStaffHost,
} from '@/lib/tenant'
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

  // goal-27 — DOOR ISOLATION. Each back-office host accepts ONLY the role-class that
  // belongs to it (super_admin ⇒ superbooking, salon_admin ⇒ booking, staff ⇒
  // minbooking). A credential used on the WRONG door is signed out immediately so no
  // session is ever left on that host — this is what shields the super-admin "godmode"
  // login from booking/minbooking (and a salon_admin from superbooking). Gated to
  // production: on preview/dev (*.localhost) the unified booking door still accepts
  // every role, keeping the e2e harness valid.
  const host = (await headers()).get('host')
  if (!isPreviewHost(host)) {
    const hostKind = getTenantFromHost(host).kind
    if (hostKind === 'superadmin' || hostKind === 'platform' || hostKind === 'staff_portal') {
      const door = backofficeHostKindForRole({ roleLevel, platformAdmin })
      if (door !== hostKind) {
        // Reject: clear the just-created session (this is the supabase client method,
        // NOT the redirecting signOut wrapper below) and point them at THEIR own door
        // — never reveal the door they probed.
        await supabase.auth.signOut()
        const rightHost =
          door === 'superadmin'
            ? getSuperadminHost()
            : door === 'platform'
              ? getPlatformHost()
              : door === 'staff_portal'
                ? getStaffHost()
                : null
        return {
          error: rightHost
            ? `Den här inloggningen hör hemma på ${rightHost}. Logga in där.`
            : 'Den här inloggningen gäller inte för den här adressen.',
        }
      }
    }
  }

  // Honor the originally requested page (same host) only AFTER the door check.
  // Kräv exakt en ledande '/' — '//host' och '/\host' tolkas som protokoll-relativa
  // URL:er av webbläsaren och blir öppna redirects.
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\'))
    redirect(next)
  redirect(portalHomeFor({ roleLevel, platformAdmin }))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export type UpdatePasswordState = { error?: string }

/**
 * Set/byt lösenord för en redan autentiserad session — landningen efter
 * /auth/confirm (invite + recovery). På succé skickas användaren till sitt
 * roll-hem (samma portalHomeFor som login).
 */
export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  if (password.length < 8) return { error: 'Lösenordet måste vara minst 8 tecken.' }
  if (password !== confirm) return { error: 'Lösenorden matchar inte.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessionen har gått ut — öppna länken i mejlet igen.' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'Lösenordet kunde inte sparas. Försök igen.' }

  // Samma roll-uppslag som signIn (RLS: egen rad + roll) → rätt portal-hem.
  const platformAdmin =
    (user.app_metadata as { platform_admin?: boolean })?.platform_admin === true
  let roleLevel = 0
  const { data: profile } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', user.id)
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
