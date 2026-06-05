'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from './guard'
import { validateSlug } from './slug'
import { isBillingModel, kronorToCents } from './billing'
import { createServiceClient, hasServiceRole } from './service'
import { logPlatformAction } from './audit'
import { isBookingVariant, DEFAULT_BOOKING_VARIANT, type BookingVariant } from './booking-variant'
import { resolveOwnerRole } from './owner-role'
import { STOREFRONT_THEMES, DEFAULT_STOREFRONT_THEME, type StorefrontTheme } from '@/lib/tenant-data'
import { revalidateTenant } from '@/lib/admin/tenant'
import { uploadImage, uploadErrorMessage, pruneRemovedImages } from '@/lib/r2/upload'
import { mergeBranding } from '@/lib/branding/merge'
import { saveRolePermissions, type RolePermissionChange } from './roles-permissions'
import { PERMISSION_AREAS, type Perm } from './catalog-shared'
import type { TenantBranding } from '@corevo/ui'

export type ActionState = { error?: string; success?: string }

const GENERIC = 'Något gick fel. Försök igen.'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_TZ = 'Europe/Stockholm'

// Storefront theme (the five named layouts). Picking a theme writes settings.theme,
// which the public layout reads → [data-theme] on the storefront root. The old A/B
// nav + 1/2 hero system is RETIRED (components/brand/variants.ts); `theme` is now the
// single look-axis, so each onboarded salon gets a DISTINCT storefront, never a clone.
function pickTheme(raw: FormDataEntryValue | null): StorefrontTheme {
  const v = String(raw ?? '').trim().toLowerCase()
  return (STOREFRONT_THEMES as readonly string[]).includes(v)
    ? (v as StorefrontTheme)
    : DEFAULT_STOREFRONT_THEME
}

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
  // Owner (design "Ägare & roll"): name is invite-metadata only (public.users has no
  // name column — frozen schema), email triggers the magic-link invite when set.
  const ownerName = String(fd.get('owner_name') ?? '').trim().slice(0, 120)
  const ownerEmail = String(fd.get('owner_email') ?? '').trim().toLowerCase()
  // Salongens stad (#14): real public column. Empty → leave null (never write '').
  const city = String(fd.get('city') ?? '').trim().slice(0, 120) || null
  // Owner role (#11): resolved through the seam (default salon_admin, byte-identical).
  const ownerRole = resolveOwnerRole(fd.get('owner_role'))
  // Billing is NOT collected in the onboarding wizard (design drops it → edited later
  // in tenant-detail / Fakturering). Defaults keep the tenant_settings row valid.
  const billingModel = 'per_booking'
  const setupFee = 0
  const perBookingFee = 0
  const flatMonthlyFee = 0

  // Storefront look (the five named themes) → settings.theme → [data-theme].
  const theme = pickTheme(fd.get('theme'))
  // Booking-vy-val (§2.4): one of the four design ids; 'wizard' default. M3 reads
  // settings.booking.variant. Held apart from the theme (look) above.
  const bookingVariantRaw = String(fd.get('booking_variant') ?? '')
  const bookingVariant: BookingVariant = isBookingVariant(bookingVariantRaw)
    ? bookingVariantRaw
    : DEFAULT_BOOKING_VARIANT
  // Token-branding (nivå 1, no-code): accent colour ONLY. We deliberately do NOT
  // write color_primary/bg/fg — those inline overrides WIN over the [data-theme]
  // palette (injectTenantTokens), which would MASK the theme just picked ("every
  // salon looks the same" trap). The theme owns the palette; accent layers a single
  // CTA colour on top. Tagline → settings.copy.tagline; logo → R2 (below).
  const colorAccent = hexOrSkip(fd.get('color_accent'))
  const tagline = String(fd.get('tagline') ?? '').trim().slice(0, 160)

  if (!name) return { error: 'Ange ett salongsnamn.' }
  if (!slugCheck.ok) return { error: slugCheck.reason }
  if (ownerEmail && !EMAIL_RE.test(ownerEmail)) return { error: 'Ogiltig e-postadress för ägaren.' }
  const slug = slugCheck.slug

  // Accent-only branding: the theme owns the palette, so we never write
  // color_primary/bg/fg here. Logo is added below once the tenant id exists.
  const initialBranding: Branding = {}
  if (colorAccent) initialBranding.color_accent = colorAccent

  // 1) tenant
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .insert({ slug, name, status: 'active', plan: 'standard', city })
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

  // Optional logo (Token-branding step): upload now that we have the tenant id for the
  // R2 path. Best-effort — a failed/absent upload never blocks the atomic create.
  const logo = fd.get('logo')
  if (logo instanceof File && logo.size > 0) {
    const res = await uploadImage(logo, `tenants/${tenantId}/branding`)
    if (res.ok) initialBranding.logo_url = res.url
  }

  // 2) tenant_settings (defaults + theme + accent/tagline branding + FLÖDE 2 billing).
  //    settings.theme is read by the public layout → [data-theme], so the new salon
  //    ships the chosen named storefront, not the default. settings.copy.tagline is
  //    the owner-editable footer/utility tagline (M2/M6 copy contract).
  const { error: sErr } = await supabase.from('tenant_settings').insert({
    tenant_id: tenantId,
    payment_mode: 'on_site',
    branding: initialBranding,
    settings: {
      theme,
      booking: { variant: bookingVariant },
      ...(tagline ? { copy: { tagline } } : {}),
    },
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

  // 4) tenant-scoped owner role. Resolved via the seam (#11): default salon_admin
  //    level 6 — owner; matches the seed. goal-21 widens OWNER_ROLE_LEVELS.
  const { data: role, error: rErr } = await supabase
    .from('roles')
    .insert({ tenant_id: tenantId, name: ownerRole.name, level: ownerRole.level })
    .select('id')
    .single()
  if (rErr || !role) {
    await rollback()
    return { error: GENERIC }
  }

  // 5) invite the owner (salon_admin) via magic-link (service role; graceful degrade
  //    when key absent). Owner name rides along as auth user_metadata.full_name
  //    (public.users has no name column — frozen schema).
  let inviteNote = ''
  if (ownerEmail) {
    const svc = createServiceClient()
    if (!svc) {
      inviteNote = ' Inbjudan ej skickad: SUPABASE_SERVICE_ROLE_KEY saknas (sätts av ops).'
    } else {
      const { data: invited, error: iErr } = await svc.auth.admin.inviteUserByEmail(
        ownerEmail,
        ownerName ? { data: { full_name: ownerName } } : undefined,
      )
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
        // #10: owner name is a READABLE column now (users.full_name), not just dead
        // auth user_metadata — the platform Ägare-card reads it. Keep the metadata
        // write above too (harmless). Empty name → null (never store '').
        const { error: uErr } = await supabase
          .from('users')
          .insert({
            id: authId,
            tenant_id: tenantId,
            email: ownerEmail,
            full_name: ownerName || null,
            role_id: role.id,
            status: 'active',
          })
        if (uErr) {
          // Don't claim success: most likely the email already has an account.
          inviteNote = ` Salongen skapad, men ägaren kunde inte kopplas (kontot finns kanske redan).`
        } else {
          await logPlatformAction(supabase, {
            action: 'tenant.invite',
            tenantId,
            actorId: user.id,
            meta: { email: ownerEmail },
          })
          inviteNote = ` Inbjudan skickad till ${ownerEmail}.`
        }
      }
    }
  }

  await logPlatformAction(supabase, {
    action: 'tenant.create',
    tenantId,
    actorId: user.id,
    meta: { slug, name, theme, booking_variant: bookingVariant },
  })

  revalidatePath('/platform')
  revalidatePath('/salonger')
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
/** Create-time colour: return a valid hex, else null (skip — keep neutral default). */
function hexOrSkip(raw: FormDataEntryValue | null): string | null {
  const v = String(raw ?? '').trim()
  return HEX_RE.test(v) ? v : null
}
type Branding = {
  color_primary?: string | null
  color_bg?: string | null
  color_fg?: string | null
  color_accent?: string | null
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
  // Read prev as the FULL branding shape (incl. owner storefront media + accent),
  // not M7's narrow Branding — mergeBranding must preserve every prev field.
  const prev = (existing?.branding ?? {}) as TenantBranding

  let logoUrl = prev.logo_url ?? null
  let warning: string | null = null
  if (removeLogo) logoUrl = null
  if (logo instanceof File && logo.size > 0) {
    const res = await uploadImage(logo, `tenants/${tenantId}/branding`)
    if (res.ok) logoUrl = res.url
    else warning = uploadErrorMessage(res.reason)
  }

  // M7 owns ONLY colours/font/logo. Merge them onto prev so the owner's
  // hero/gallery/about/closing/team/stats AND color_accent are never clobbered
  // (the old fresh-object upsert wiped them). Patch keys are exactly these five.
  const branding = mergeBranding(prev, {
    color_primary: colorPrimary,
    color_bg: colorBg,
    color_fg: colorFg,
    font_body: fontBody || null,
    logo_url: logoUrl,
  })

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, branding }, { onConflict: 'tenant_id' })
  if (error) return { error: GENERIC }

  // FX-14: drop the previous logo object when replaced/removed. Logo-only — a
  // platform branding-save must not touch owner storefront media, and now that the
  // DB clobber is gone `prev` keeps all media so it can never appear in this set.
  await pruneRemovedImages([prev.logo_url], [branding.logo_url])

  // CRITICAL: bust the cached public bundle so branding shows immediately (M2/M3).
  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, { action: 'tenant.branding', tenantId, actorId: user.id })
  return warning ? { error: warning } : { success: 'Varumärke sparat. Publika sajten uppdaterad.' }
}

// ── Step 6: launch / suspend ────────────────────────────────────────────────────
export async function setTenantStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const status = String(fd.get('status') ?? '')
  if (!tenantId) return { error: 'Saknar salong.' }
  // 'deleted' = soft delete: flip tenants.status (NEVER .delete() — keep the history).
  if (status !== 'active' && status !== 'suspended' && status !== 'deleted')
    return { error: 'Ogiltig status.' }

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
  revalidatePath('/salonger')
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action:
      status === 'deleted'
        ? 'tenant.delete'
        : status === 'suspended'
          ? 'tenant.suspend'
          : 'tenant.activate',
    tenantId,
    actorId: user.id,
    meta: { status },
  })
  return {
    success:
      status === 'deleted'
        ? 'Salongen är borttagen — publika sajten och admin blockeras.'
        : status === 'suspended'
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

  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/fakturering')
  await logPlatformAction(supabase, {
    action: 'tenant.billing',
    tenantId,
    actorId: user.id,
    meta: { billing_model: billingModel },
  })
  return { success: 'Prismodell sparad.' }
}

// ── §2.1B Operativ data-kontroll ("Supabase med mitt UI", no-code) ──────────────

/** https-URL or null (empty), else undefined = invalid. Mirrors M6's httpsUrlOrNull
 *  so the operator gets the same friendly rejection on a bad review link. */
function httpsUrlOrNull(raw: FormDataEntryValue | null): string | null | undefined {
  const v = String(raw ?? '').trim()
  if (v === '') return null
  try {
    return new URL(v).protocol === 'https:' ? v : undefined
  } catch {
    return undefined
  }
}

/**
 * Edit a tenant's safe operative fields from the platform UI: salon name,
 * Google-review link, and the booking-vy-val (Variant 3/4). This is Zivar's
 * "klicka i mitt UI istället för rå Supabase" surface.
 *
 * MERGE, never clobber: settings is a jsonb co-owned with M6 (contact,
 * notifications, cancellation, layout, theme …). We read prev settings and spread
 * `...prev` before writing OUR keys — the B1/§3 settings-krock guard. `slug` is
 * deliberately NOT editable here (live subdomain, cached + RLS-bound).
 */
export async function saveTenantData(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar salong.' }

  const name = String(fd.get('name') ?? '').trim()
  // Stad (#14): editable here too. Absent field → undefined = leave as-is; present but
  // blank → null (clear). Lets a later edit-UI thread city without forcing it.
  const cityRaw = fd.get('city')
  const city = cityRaw === null ? undefined : String(cityRaw).trim().slice(0, 120) || null
  const reviewUrl = httpsUrlOrNull(fd.get('google_review_url'))
  const variantRaw = String(fd.get('booking_variant') ?? '')

  if (!name) return { error: 'Ange ett salongsnamn.' }
  if (reviewUrl === undefined)
    return { error: 'Ogiltig recensionslänk. Använd en https-länk, t.ex. https://g.page/r/.../review.' }
  const bookingVariant: BookingVariant = isBookingVariant(variantRaw)
    ? variantRaw
    : DEFAULT_BOOKING_VARIANT

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  // 1) tenant name (+ city when the field is present) — feeds the cached public bundle
  //    (same field M6 saveSettings edits). city omitted = untouched; '' = cleared.
  const tenantPatch: { name: string; city?: string | null } = { name }
  if (city !== undefined) tenantPatch.city = city
  const { error: nErr } = await supabase.from('tenants').update(tenantPatch).eq('id', tenantId)
  if (nErr) return { error: GENERIC }

  // 2) settings jsonb — MERGE prev (never replace). google_review_url is co-owned
  //    with M6; booking.variant is M7's key (M3 reads tenant_settings.settings.booking).
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const prevBooking = (prev.booking ?? {}) as Record<string, unknown>
  const settings = {
    ...prev,
    google_review_url: reviewUrl, // M6/M7 co-own (FAS0 §3) — null = nudge off
    booking: { ...prevBooking, variant: bookingVariant }, // M7-ägd; M3 läser
  }
  const { error: sErr } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (sErr) return { error: GENERIC }

  // Bust the cached public bundle so the new name/review link/variant show live.
  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.update',
    tenantId,
    actorId: user.id,
    meta: { name, booking_variant: bookingVariant, review_url: reviewUrl ? 'set' : 'cleared' },
  })
  return { success: 'Salongsdata sparad. Publika sajten uppdaterad.' }
}

/**
 * Trigger a password reset for the salon's admin. Generates a recovery link via
 * the service role and surfaces it for Zivar to hand over (no cross-revir email
 * wiring in v1). Gated on hasServiceRole() — degrades with a clear ops message
 * when SUPABASE_SERVICE_ROLE_KEY is unset, never throws.
 */
export async function sendPasswordReset(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  if (!tenantId) return { error: 'Saknar salong.' }
  if (!email || !EMAIL_RE.test(email)) return { error: 'Ogiltig e-postadress.' }

  if (!hasServiceRole())
    return { error: 'Lösenords-reset kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops).' }
  const svc = createServiceClient()
  if (!svc) return { error: 'Lösenords-reset kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops).' }

  const { data, error } = await svc.auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data?.properties?.action_link) {
    return { error: `Kunde inte skapa återställningslänk: ${error?.message ?? 'okänt fel'}.` }
  }

  await logPlatformAction(supabase, {
    action: 'tenant.password_reset',
    tenantId,
    actorId: user.id,
    meta: { email },
  })
  return {
    success: `Återställningslänk skapad för ${email}. Kopiera och dela den säkert:\n${data.properties.action_link}`,
  }
}

/**
 * Zivar-assisterad personal-onboarding (M7 §2.4): create a staff row on a CHOSEN
 * tenant via the platform RLS-bypass. Mirrors M6 createStaff (title-only row; no
 * forced fields beyond what the table needs) and attaches the tenant's primary
 * location when one exists. Audit-logged against the tenant.
 */
export async function createTenantStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const title = String(fd.get('title') ?? '').trim()
  if (!tenantId) return { error: 'Saknar salong.' }
  if (!title) return { error: 'Ange ett namn/en titel.' }

  // Primary location (load-bearing for staff↔location, but optional in the schema).
  const { data: loc } = await supabase
    .from('locations')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('staff').insert({
    tenant_id: tenantId,
    location_id: loc?.id ?? null,
    title,
    active: true,
  })
  if (error) return { error: GENERIC }

  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.staff_create',
    tenantId,
    actorId: user.id,
    meta: { title },
  })
  return { success: `Medarbetare "${title}" tillagd hos salongen.` }
}

/**
 * Open "hjälp-läge" for a tenant. This is the HONEST minimal version (#1): it does
 * NO impersonation and changes NO tenant data — it only writes ONE platform-side
 * audit row so Zivar's act of opening a salon's help-view is logged at the platform.
 * The actor comes from platformCtx (the authed platform_admin), never the client.
 */
export async function enterHelpMode(tenantId: string): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  if (!tenantId) return { error: 'Saknar salong.' }
  await logPlatformAction(supabase, {
    action: 'platform.help_mode_open',
    tenantId,
    actorId: user.id,
  })
  return { success: 'Hjälp-läge öppnat — loggat.' }
}

// ── goal-21: save the editable RBAC permission matrix ───────────────────────────
/**
 * Persist edited matrix cells. The platform_admin fence + the super_admin
 * self-lockout guard + the audit log live in saveRolePermissions (roles-permissions.ts,
 * server-only). This 'use server' wrapper just adapts the client payload (a JSON array
 * of {roleName, area, perm}) to that module call and revalidates the roller page.
 */
export async function saveRolePermissionsAction(
  changes: { roleName: string; area: string; perm: Perm }[],
): Promise<ActionState> {
  const safe = (Array.isArray(changes) ? changes : []).filter(
    (c): c is RolePermissionChange =>
      typeof c?.roleName === 'string' &&
      (PERMISSION_AREAS as readonly string[]).includes(c?.area) &&
      ((['full', 'own', 'view', '—'] as const) as readonly string[]).includes(c?.perm),
  )
  const res = await saveRolePermissions(safe)
  if (res.success) revalidatePath('/roller')
  return res
}
