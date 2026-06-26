'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { validateSlug } from '../slug'
import { createServiceClient } from '../service'
import { logPlatformAction } from '../audit'
import { isBookingVariant, DEFAULT_BOOKING_VARIANT, type BookingVariant } from '../booking-variant'
import { resolveOwnerRole } from '../owner-role'
import { parseModuleSelections, writeTenantVerticalAndModules } from '../tenant-modules-write'
import { parseServiceInputs } from '../onboarding-studio/services'
import { STOREFRONT_THEMES, DEFAULT_STOREFRONT_THEME, type StorefrontTheme } from '@/lib/tenant-data'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { uploadImage } from '@/lib/r2/upload'
import { attachWorkerSubdomain } from '@/lib/cloudflare/worker-domains'
import { foldOnboardingDraft } from '@/lib/sajtbyggare/onboarding-fold'
import type { Json } from '@corevo/db'
import { type ActionState, GENERIC, EMAIL_RE, HEX_RE } from './shared'
import { reportActionError } from './observe'

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
  // goal-50: a render-bron LOOK from the box (e.g. 'restoran') arrives in the same
  // `theme` field but is NOT one of the 5 named themes → pickTheme coerces it to the
  // default. Capture it separately into settings.look so the storefront renders the
  // look's real HTML. Flag-gated: only when sajtbyggare is ON (flag-OFF never writes
  // `look` → byte-identical legacy). Registry-validated at the storefront dispatch.
  const rawTheme = String(fd.get('theme') ?? '').trim().toLowerCase()
  const lookKey =
    sajtbyggareEnabled() && rawTheme && !(STOREFRONT_THEMES as readonly string[]).includes(rawTheme)
      ? rawTheme
      : null
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
  // Hero copy (onboarding-studio W5) → settings.copy.{heroTitle,heroLede}. heroTitle is
  // the hero headline (may carry an inner \n the layout honours), heroLede the supporting
  // paragraph (= the "ingress", NOT the footer tagline above). Empty → omitted, so the
  // theme's own default copy wins per field in resolveThemeContent.
  const heroTitle = String(fd.get('hero_title') ?? '').trim().slice(0, 200)
  const heroLede = String(fd.get('hero_lede') ?? '').trim().slice(0, 500)
  // Multi-bransch (spår 5): the wizard's bransch (step 0) → tenants.vertical_id, and
  // the "Moduler" step's per-module states → tenant_modules rows. vertical_id is a
  // mjuk, mutabel FK (null = no bransch picked). `modules` is a JSON map
  // { module_key: state }; parseModuleSelections drops garbage, the write helper
  // floors booking→live (FreshCut-parity) + fences to the catalog.
  const verticalKey = String(fd.get('vertical_id') ?? '').trim().slice(0, 64) || null
  const moduleSelections = parseModuleSelections(fd.get('modules'))

  // Multi-bransch: the wizard serves every bransch (frisör, restaurang, …), so the
  // validation text stays bransch-neutral ("namn", not "salongsnamn"). The branschens
  // egna ord visas i wizard-UI:t (terminology); detta är server-sidans säkra fallback.
  if (!name) return { error: 'Ange ett namn.' }
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
    await reportActionError('createTenant.tenant_insert', tErr, { slug })
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
  // Owner copy overrides (settings.copy) — each field wins over the theme default in
  // resolveThemeContent (public page + studio preview). Built as ONE object so adding
  // hero copy never half-sets or clobbers the tagline.
  const copy: Record<string, string> = {}
  if (tagline) copy.tagline = tagline
  if (heroTitle) copy.heroTitle = heroTitle
  if (heroLede) copy.heroLede = heroLede
  const settings = {
    theme,
    ...(lookKey ? { look: lookKey } : {}),
    booking: { variant: bookingVariant },
    ...(Object.keys(copy).length ? { copy } : {}),
  }

  // Sajtbyggare (goal-37/38): the onboarding editor posts a JSON draft (region.key →
  // value) in the hidden `site_content_draft` input. We FOLD it ON TOP of the base
  // settings/branding above (accent + logo + tagline are the base; the draft becomes
  // the new tenant's sanitized Kund-overrides). PURE + fail-open: a bad draft NEVER
  // fails tenant creation — we just keep the base. Only the salvia manifest is wired
  // today; any other theme ignores the draft.
  // Fold the onboarding editor's site_content_draft on top of the base settings/branding
  // via the sanitizing apply-core (PURE + fail-open — a bad/empty draft keeps the base,
  // never blocks onboarding). Only salvia is wired today. Tested: onboarding-fold.test.ts.
  const folded = foldOnboardingDraft(
    theme,
    String(fd.get('site_content_draft') ?? ''),
    settings,
    initialBranding as unknown as Record<string, unknown>,
  )
  const settingsForInsert: Json = folded.settings as unknown as Json
  const brandingForInsert: Json = folded.branding as unknown as Json

  const { error: sErr } = await supabase.from('tenant_settings').insert({
    tenant_id: tenantId,
    payment_mode: 'on_site',
    branding: brandingForInsert,
    settings: settingsForInsert,
    billing_model: billingModel,
    setup_fee_cents: setupFee,
    per_booking_fee_cents: perBookingFee,
    flat_monthly_fee_cents: flatMonthlyFee,
  })
  if (sErr) {
    await rollback()
    await reportActionError('createTenant.settings_insert', sErr, { tenantId })
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
    await reportActionError('createTenant.location_insert', lErr, { tenantId })
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
    await reportActionError('createTenant.role_insert', rErr, { tenantId })
    return { error: GENERIC }
  }

  // 4b) vertical + modules (multi-bransch spår 5). Atomic with the steps above
  //     (same cascade-rollback window): writes tenants.vertical_id + tenant_modules
  //     rows (chosen states; booking floored to live). Runs under the platform client
  //     → the DB state-guard (0026 §9) admits off→draft/live because the JWT carries
  //     platform_admin. A failure rolls the whole tenant back so no half-provisioned
  //     module set lingers.
  const modRes = await writeTenantVerticalAndModules(supabase, tenantId, verticalKey, moduleSelections)
  if (!modRes.ok) {
    await rollback()
    await reportActionError('createTenant.modules_write', new Error('writeTenantVerticalAndModules failed'), { tenantId })
    return { error: GENERIC }
  }

  // 4c) services (onboarding-studio W4). The content the booking module reads —
  //     bookings.service_id is NOT NULL, so a salon with zero services literally can't
  //     take a booking (same load-bearing tier as the primary location). Conditional on
  //     count>0 (the operator may skip + add them later in admin) and INSIDE the rollback
  //     window: a provided-but-failed write rolls the whole tenant back so no broken,
  //     half-provisioned salon lingers. parseServiceInputs is the trust boundary (trims,
  //     clamps price_cents ≥0, caps count). duration_min: the design collects no
  //     duration, so seed the universal default; the owner edits it per service in admin.
  const serviceRows = parseServiceInputs(fd.get('services'))
  if (serviceRows.length > 0) {
    const { error: svcErr } = await supabase.from('services').insert(
      serviceRows.map((s) => ({
        tenant_id: tenantId,
        name: s.name,
        duration_min: 30, // ponytail: no duration field in the design; 30 = sane default, owner edits in admin
        price_cents: s.price_cents,
        active: true,
      })),
    )
    if (svcErr) {
      await rollback()
      await reportActionError('createTenant.services_insert', svcErr, { tenantId })
      return { error: GENERIC }
    }
  }

  // 5) invite the owner (salon_admin) via magic-link (service role; graceful degrade
  //    when key absent). Owner name rides along as auth user_metadata.full_name
  //    (public.users has no name column — frozen schema).
  let inviteNote = ''
  // Orphan-salong guard (CHECKLISTA W0 #2): non-null = the owner was requested but
  // couldn't be created+linked → roll the whole tenant back so no half-provisioned
  // "ghost salon" lingers. Only set when ownerEmail was given; owner-less onboarding
  // never trips it.
  let ownerFailed: string | null = null
  if (ownerEmail) {
    const svc = createServiceClient()
    if (!svc) {
      // No service role → we literally cannot create the owner's auth account. Don't
      // leave an un-ownable salon behind; roll back below. Survivable: onboard WITHOUT
      // an owner email and invite later, or ops sets SUPABASE_SERVICE_ROLE_KEY.
      ownerFailed =
        'inbjudan kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops) — eller skapa salongen utan ägar-epost och bjud in ägaren senare'
    } else {
      // Carry the salon name into invite user_metadata so the Supabase invite
      // template can greet with the salon's name ({{ .Data.tenant_name }}) instead
      // of the generic "Corevo" default (W0 #3). full_name stays optional.
      const { data: invited, error: iErr } = await svc.auth.admin.inviteUserByEmail(
        ownerEmail,
        { data: { ...(ownerName ? { full_name: ownerName } : {}), tenant_name: name } },
      )
      if (iErr || !invited?.user) {
        ownerFailed = `inbjudan misslyckades (${iErr?.message ?? 'okänt fel'})`
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
          // The auth user WAS created but couldn't be linked (most likely the email
          // already has an account). Best-effort delete it so the rollback below doesn't
          // leave an orphan auth identity dangling without its tenant.
          await svc.auth.admin.deleteUser(authId).catch(() => {})
          ownerFailed = 'ägaren kunde inte kopplas (kontot finns kanske redan med den e-posten)'
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
    // ROLL BACK on any owner-creation failure: a provoked invite-fail must leave ZERO
    // ghost salons (CHECKLISTA W0 #2). rollback() deletes the tenant → cascades to
    // settings/location/role/modules/services. The operator gets an actionable error.
    if (ownerFailed) {
      await rollback()
      return { error: `Salongen skapades inte: ${ownerFailed}. Försök igen.` }
    }
  }

  await logPlatformAction(supabase, {
    action: 'tenant.create',
    tenantId,
    actorId: user.id,
    meta: { slug, name, theme, ...(lookKey ? { look: lookKey } : {}), booking_variant: bookingVariant, vertical_id: verticalKey },
  })

  // goal-32 F2 — couple <slug>.corevo.se to the worker. The DURABLE coupling is
  // mechanism (A): this tenant row is now in the DB, so scripts/gen-deploy-config.mjs
  // includes <slug>.corevo.se in the NEXT deploy and every deploy after re-asserts it
  // (it can never be detached). This call ALSO tries to attach it IMMEDIATELY (no
  // deploy wait) via the Workers Domains API — but it is best-effort and DORMANT in
  // prod (fail-closed without a scoped CF token + DOMAIN_AUTOATTACH_ENABLED). It must
  // NEVER block or fail onboarding: a miss just means the domain goes live at the next
  // deploy instead of instantly. Idempotent + add-only — never removes anything.
  try {
    await attachWorkerSubdomain(slug)
  } catch {
    // swallow — domain still rides the next deploy via the generator.
  }

  revalidatePath('/platform')
  revalidatePath('/salonger')
  // HONEST status (W6): the tenant is created + the booking engine + owner admin work
  // immediately, but the PUBLIC host <slug>.corevo.se is NOT auto-attached (runtime
  // auto-attach is dormant + the next-deploy path was retired in fix-35 → connecting the
  // domain is a separate add-domain.mjs step). So don't claim it's "live på <slug>" here.
  return {
    success: `Salong "${name}" skapad (${slug}.corevo.se).${inviteNote}`,
    tenant: { id: tenantId, slug },
  }
}
