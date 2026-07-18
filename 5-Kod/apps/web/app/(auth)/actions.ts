'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  portalHomeFor,
  backofficeHostKindForRole,
  loginAccessForHost,
  isActiveLoginAccount,
  PORTAL_MIN_LEVEL,
  type LoginHostKind,
} from '@/lib/auth/roles'
import { safeInternalRedirectPath } from '@/lib/auth/internal-redirect'
import {
  getTenantFromHost,
  isPreviewHost,
  getSuperadminHost,
  getPlatformHost,
  getStaffHost,
} from '@/lib/tenant'
import {
  checkRateLimitFailClosed,
  getClientIp,
  rateLimitKey,
  LIMITS,
} from '@/lib/security/rate-limit'
import { currentKundTenant } from '@/lib/kund/tenant'
import {
  isRejectedPartnerIdentity,
  resolvePlatformIdentity,
} from '@/lib/auth/platform-identity'

export type SignInState = { error?: string }

/**
 * Sign in with email + password (Supabase Auth). On success, redirect to the
 * originally requested page (`next`) or the role-appropriate portal home.
 * Wrong credentials get a single friendly message (no user-enumeration).
 */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeInternalRedirectPath(String(formData.get('next') ?? ''))

  if (!email || !password) return { error: 'Fyll i både e-post och lösenord.' }

  // Rate-limit by IP (G10) — slows credential-stuffing. App-layer complement to
  // the Cloudflare WAF rule (primary, documented in ops). Login fails closed if
  // the limiter is unavailable so credential-stuffing protection cannot vanish.
  const ip = await getClientIp()
  if (!(await checkRateLimitFailClosed(rateLimitKey('login', ip), LIMITS.login))) {
    return { error: 'För många inloggningsförsök. Vänta en stund och försök igen.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return { error: 'Fel e-post eller lösenord. Försök igen.' }
  }

  // Role level from the just-authenticated client (RLS: own row + role).
  const platformAdminClaim =
    (data.user.app_metadata as { platform_admin?: boolean })?.platform_admin === true
  let roleLevel = 0
  let roleName: string | null = null
  let roleTenantId: string | null = null
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role_id, status')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profile?.role_id) {
    const { data: role } = await supabase
      .from('roles')
      .select('level, name, tenant_id')
      .eq('id', profile.role_id)
      .maybeSingle()
    roleLevel = role?.level ?? 0
    roleName = role?.name ?? null
    roleTenantId = role?.tenant_id ?? null
  }

  // The database row is authoritative even while an old JWT/session remains in
  // the browser. A staff account additionally requires its active staff binding.
  let activeStaff = false
  if (
    profile?.status === 'active' &&
    roleLevel === PORTAL_MIN_LEVEL.personal &&
    profile.tenant_id
  ) {
    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('profile_id', data.user.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    activeStaff = Boolean(staff)
  }
  const accountActive = isActiveLoginAccount({
    profileStatus: profile?.status,
    roleLevel,
    activeStaff,
  })
  if (!accountActive) {
    await supabase.auth.signOut()
    return { error: 'Kontot är inte aktivt. Kontakta företaget som bjöd in dig.' }
  }

  let membership: {
    partnerId: string
    memberStatus: string | null
    partnerStatus: string | null
  } | null = null
  if (roleName === 'partner_admin' && roleLevel === 7 && roleTenantId === null) {
    const { data: member } = await supabase
      .from('partner_members')
      .select('partner_id, status, partners:partner_id(status)')
      .eq('user_id', data.user.id)
      .maybeSingle()
    const partnerEmbed = (member as { partners?: unknown } | null)?.partners
    const partner = (Array.isArray(partnerEmbed) ? partnerEmbed[0] : partnerEmbed) as
      | { status: string | null }
      | null
      | undefined
    if (member?.partner_id) {
      membership = {
        partnerId: member.partner_id,
        memberStatus: member.status,
        partnerStatus: partner?.status ?? null,
      }
    }
  }
  const { platformAdmin, partnerAdmin } = resolvePlatformIdentity({
    accountAuthorized: accountActive,
    roleLevel,
    roleName,
    roleTenantId,
    appPlatformAdmin: platformAdminClaim,
    membership,
  })
  if (isRejectedPartnerIdentity({
    accountAuthorized: accountActive,
    roleLevel,
    roleName,
    roleTenantId,
    partnerAdmin,
  })) {
    await supabase.auth.signOut()
    return { error: 'Partnerkontot är inte aktivt. Kontakta Corevo.' }
  }

  // U5 — DOOR ISOLATION. Each account establishes a session only on its own host:
  // super_admin ⇒ superbooking, owner/staff ⇒ booking, customer ⇒ its exact
  // tenant host. minbooking remains one explicit staff-only legacy exception. A
  // credential used on the WRONG door is signed out immediately so no
  // session is ever left on that host — this is what shields the super-admin "godmode"
  // login from booking/minbooking (and a salon_admin from superbooking). Gated to
  // production: on preview/dev (*.localhost) the unified booking door still accepts
  // every role, keeping the e2e harness valid.
  const host = (await headers()).get('host')
  let staffOnLegacyDoor = false
  if (!isPreviewHost(host)) {
    const resolved = getTenantFromHost(host)
    const hostTenant = await currentKundTenant()
    const hostKind: LoginHostKind =
      resolved.kind === 'superadmin' ||
      resolved.kind === 'platform' ||
      resolved.kind === 'staff_portal'
        ? resolved.kind
        : hostTenant
          ? 'tenant'
          : 'other'
    const access = loginAccessForHost({
      roleLevel,
      platformAdmin,
      partnerAdmin,
      accountTenantId: profile?.tenant_id ?? null,
      hostKind,
      hostTenantId: hostTenant?.id ?? null,
    })
    staffOnLegacyDoor = access.legacyStaff
    if (!access.allowed) {
      // Reject and clear the session on this host. Host-only cookies guarantee
      // that parallel logins in other tabs/doors remain untouched.
      await supabase.auth.signOut()
      const door = backofficeHostKindForRole({ roleLevel, platformAdmin, partnerAdmin })
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
          : 'Den här inloggningen gäller inte för den här företagsadressen.',
      }
    }
  }

  // Personal som loggade in på den gamla minbooking-dörren stannar i /personal —
  // deras hemadress i adminkalendern ligger på en annan värd (ingen session där).
  if (staffOnLegacyDoor) redirect('/personal')
  // Honor the originally requested page (same host) only AFTER the door check.
  if (next) redirect(next)
  redirect(portalHomeFor({ roleLevel, platformAdmin, partnerAdmin }))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
