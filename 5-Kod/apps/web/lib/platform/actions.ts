'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from './guard'
import { validateSlug } from './slug'
import { isBillingModel, kronorToCents } from './billing'
import { createServiceClient } from './service'
import { logPlatformAction } from './audit'
import { revalidateTenant } from '@/lib/admin/tenant'
import { uploadImage, uploadErrorMessage } from '@/lib/r2/upload'

export type ActionState = { error?: string; success?: string }

const GENERIC = 'Något gick fel. Försök igen.'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_TZ = 'Europe/Stockholm'

// ── Step 1: create tenant (transaktion via cascade-rollback) ────────────────────
/**
 * Create a tenant + default settings + primary location + salon_admin role, then
 * (best-effort) invite the salon_admin. "Transaction": tenants is the parent and
 * every child FKs it ON DELETE CASCADE, so any mid-flow failure deletes the tenant
 * and the partial children vanish with it. All DB writes use the authed platform
 * client (RLS bypass via is_platform_admin); only the auth-user invite needs the
 * service role — which degrades gracefully when SUPABASE_SERVICE_ROLE_KEY is unset.
 */
export async function createTenant(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const name = String(fd.get('name') ?? '').trim()
  const slugCheck = validateSlug(String(fd.get('slug') ?? ''))
  const adminEmail = String(fd.get('admin_email') ?? '').trim().toLowerCase()
  const billingModel = String(fd.get('billing_model') ?? 'per_booking')
  const setupFee = kronorToCents(String(fd.get('setup_fee') ?? '')) ?? 0
  const perBookingFee = kronorToCents(String(fd.get('per_booking_fee') ?? '')) ?? 0
  const flatMonthlyFee = kronorToCents(String(fd.get('flat_monthly_fee') ?? '')) ?? 0

  if (!name) return { error: 'Ange ett salongsnamn.' }
  if (!slugCheck.ok) return { error: slugCheck.reason }
  if (!isBillingModel(billingModel)) return { error: 'Ogiltig prismodell.' }
  if (adminEmail && !EMAIL_RE.test(adminEmail)) return { error: 'Ogiltig e-postadress för salongsadmin.' }
  const slug = slugCheck.slug

  // 1) tenant
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .insert({ slug, name, status: 'active', plan: 'standard' })
    .select('id, slug')
    .single()
  if (tErr || !tenant) {
    if (tErr?.code === '23505') return { error: `Subdomänen "${slug}.corevo.se" är upptagen.` }
    return { error: GENERIC }
  }
  const tenantId = tenant.id
  const rollback = async () => {
    await supabase.from('tenants').delete().eq('id', tenantId) // cascades to children
  }

  // 2) tenant_settings (defaults + FLÖDE 2 billing)
  const { error: sErr } = await supabase.from('tenant_settings').insert({
    tenant_id: tenantId,
    payment_mode: 'on_site',
    branding: {},
    settings: {},
    billing_model: billingModel,
    setup_fee_cents: setupFee,
    per_booking_fee_cents: perBookingFee,
    flat_monthly_fee_cents: flatMonthlyFee,
  })
  if (sErr) {
    await rollback()
    return { error: GENERIC }
  }

  // 3) primary location — LOAD-BEARING: create_public_booking inserts
  //    bookings.location_id (NOT NULL) from the primary location, so without it
  //    the tenant can never take a booking.
  const { error: lErr } = await supabase
    .from('locations')
    .insert({ tenant_id: tenantId, name, timezone: DEFAULT_TZ, is_primary: true })
  if (lErr) {
    await rollback()
    return { error: GENERIC }
  }

  // 4) tenant-scoped salon_admin role (level 6 — owner; matches the seed)
  const { data: role, error: rErr } = await supabase
    .from('roles')
    .insert({ tenant_id: tenantId, name: 'salon_admin', level: 6 })
    .select('id')
    .single()
  if (rErr || !role) {
    await rollback()
    return { error: GENERIC }
  }

  // 5) invite salon_admin (service role; graceful degrade when key absent)
  let inviteNote = ''
  if (adminEmail) {
    const svc = createServiceClient()
    if (!svc) {
      inviteNote = ' Inbjudan ej skickad: SUPABASE_SERVICE_ROLE_KEY saknas (sätts av ops).'
    } else {
      const { data: invited, error: iErr } = await svc.auth.admin.inviteUserByEmail(adminEmail)
      if (iErr || !invited?.user) {
        inviteNote = ` Salongen skapad, men inbjudan misslyckades: ${iErr?.message ?? 'okänt fel'}.`
      } else {
        const authId = invited.user.id
        // Bake tenant_id into app_metadata so the JWT carries it even before the
        // Custom Access Token Hook is enabled (same belt-and-suspenders as seed).
        await svc.auth.admin.updateUserById(authId, {
          app_metadata: { tenant_id: tenantId, platform_admin: false },
        })
        // The public.users row is a plain cross-tenant DB write — use the authed
        // platform client (RLS bypass via is_platform_admin), NOT the service role.
        // Only the auth.admin.* calls above genuinely require svc.
        const { error: uErr } = await supabase
          .from('users')
          .insert({ id: authId, tenant_id: tenantId, email: adminEmail, role_id: role.id, status: 'active' })
        if (uErr) {
          // Don't claim success: most likely the email already has an account.
          inviteNote = ` Salongen skapad, men salongsadmin kunde inte kopplas (kontot finns kanske redan).`
        } else {
          await logPlatformAction(supabase, {
            action: 'tenant.invite',
            tenantId,
            actorId: user.id,
            meta: { email: adminEmail },
          })
          inviteNote = ` Inbjudan skickad till ${adminEmail}.`
        }
      }
    }
  }

  await logPlatformAction(supabase, {
    action: 'tenant.create',
    tenantId,
    actorId: user.id,
    meta: { slug, name, billing_model: billingModel },
  })

  revalidatePath('/platform')
  revalidatePath('/platform/tenants')
  return {
    success: `Salong "${name}" skapad och live på ${slug}.corevo.se.${inviteNote}`,
  }
}

// ── Step 2: branding (platform edits a chosen tenant) ───────────────────────────
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
function hexOrNull(raw: FormDataEntryValue | null): string | null | undefined {
  const v = String(raw ?? '').trim()
  if (v === '') return null
  return HEX_RE.test(v) ? v : undefined
}
type Branding = {
  color_primary?: string | null
  color_bg?: string | null
  color_fg?: string | null
  font_body?: string | null
  logo_url?: string | null
}

export async function savePlatformBranding(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar salong.' }

  const colorPrimary = hexOrNull(fd.get('color_primary'))
  const colorBg = hexOrNull(fd.get('color_bg'))
  const colorFg = hexOrNull(fd.get('color_fg'))
  if (colorPrimary === undefined || colorBg === undefined || colorFg === undefined)
    return { error: 'Ogiltig färgkod. Använd hex, t.ex. #1f6feb.' }
  const fontBody = String(fd.get('font_body') ?? '').trim().slice(0, 120)
  const removeLogo = String(fd.get('remove_logo') ?? '') === 'true'
  const logo = fd.get('logo')

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.branding ?? {}) as Branding

  let logoUrl = prev.logo_url ?? null
  let warning: string | null = null
  if (removeLogo) logoUrl = null
  if (logo instanceof File && logo.size > 0) {
    const res = await uploadImage(logo, `tenants/${tenantId}/branding`)
    if (res.ok) logoUrl = res.url
    else warning = uploadErrorMessage(res.reason)
  }

  const branding: Branding = {
    color_primary: colorPrimary,
    color_bg: colorBg,
    color_fg: colorFg,
    font_body: fontBody || null,
    logo_url: logoUrl,
  }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, branding }, { onConflict: 'tenant_id' })
  if (error) return { error: GENERIC }

  // CRITICAL: bust the cached public bundle so branding shows immediately (M2/M3).
  revalidateTenant(tenant.slug)
  revalidatePath(`/platform/tenants/${tenantId}`)
  await logPlatformAction(supabase, { action: 'tenant.branding', tenantId, actorId: user.id })
  return warning ? { error: warning } : { success: 'Varumärke sparat. Publika sajten uppdaterad.' }
}

// ── Step 6: launch / suspend ────────────────────────────────────────────────────
export async function setTenantStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const status = String(fd.get('status') ?? '')
  if (!tenantId) return { error: 'Saknar salong.' }
  if (status !== 'active' && status !== 'suspended') return { error: 'Ogiltig status.' }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .update({ status })
    .eq('id', tenantId)
    .select('slug')
    .single()
  if (error || !tenant) return { error: GENERIC }

  // CRITICAL: the public bundle is tag-cached (getTenantBySlug, revalidate:300).
  // Without busting the tag a suspend stays live up to 5 min — DoD would "fail".
  revalidateTenant(tenant.slug)
  revalidatePath('/platform')
  revalidatePath('/platform/tenants')
  revalidatePath(`/platform/tenants/${tenantId}`)
  await logPlatformAction(supabase, {
    action: status === 'suspended' ? 'tenant.suspend' : 'tenant.activate',
    tenantId,
    actorId: user.id,
    meta: { status },
  })
  return {
    success:
      status === 'suspended'
        ? 'Salongen är pausad — publika sajten blockeras.'
        : 'Salongen är aktiv igen — publika sajten öppen.',
  }
}

// ── FLÖDE 2: billing model + fees ───────────────────────────────────────────────
export async function saveBilling(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar salong.' }
  const billingModel = String(fd.get('billing_model') ?? 'per_booking')
  if (!isBillingModel(billingModel)) return { error: 'Ogiltig prismodell.' }
  const setupFee = kronorToCents(String(fd.get('setup_fee') ?? '')) ?? 0
  const perBookingFee = kronorToCents(String(fd.get('per_booking_fee') ?? '')) ?? 0
  const flatMonthlyFee = kronorToCents(String(fd.get('flat_monthly_fee') ?? '')) ?? 0

  const { error } = await supabase.from('tenant_settings').upsert(
    {
      tenant_id: tenantId,
      billing_model: billingModel,
      setup_fee_cents: setupFee,
      per_booking_fee_cents: perBookingFee,
      flat_monthly_fee_cents: flatMonthlyFee,
    },
    { onConflict: 'tenant_id' },
  )
  if (error) return { error: GENERIC }

  revalidatePath(`/platform/tenants/${tenantId}`)
  revalidatePath('/platform/fakturering')
  await logPlatformAction(supabase, {
    action: 'tenant.billing',
    tenantId,
    actorId: user.id,
    meta: { billing_model: billingModel },
  })
  return { success: 'Prismodell sparad.' }
}
