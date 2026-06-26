// Onboarding-studio (goal-48) — PURE cfg-state model, shared by the studio shell and
// its step panels. Ported from the design's app.jsx INIT + chooseVertical/stateFor,
// but driven by the REAL presets (VerticalPreset has no hero/services/defaultPos —
// those were cfg-data mockup; content seeding comes from the template, placement is
// a later wave). Mirrors CreateTenantForm's inline logic so the flag-OFF fallback
// stays byte-identical; once the studio is proven the form retires and the dup goes.
import type { ModuleState } from '@/lib/tenant-modules'
import { type BookingVariant, DEFAULT_BOOKING_VARIANT } from '@/lib/platform/booking-variant'
import { modulesForVertical, type VerticalPresetData } from '@/lib/platform/verticals-shared'

/** One onboarding service row (W4). `price` is the kr string the operator types (UI-
 *  friendly — no controlled-number fight); buildCreateTenantFormData converts it to
 *  integer öre at the FormData boundary, the server re-validates (services.ts). */
export type StudioService = { name: string; price: string }

export type StudioCfg = {
  /** chosen bransch (vertical key) — null until the operator picks one. */
  branch: string | null
  name: string
  slug: string
  /** true once the operator edits the slug by hand → name changes stop auto-syncing it. */
  slugTouched: boolean
  /** template key (settings.theme). Defaults to the built-in default until a bransch sets it. */
  theme: string
  variant: BookingVariant
  /** module_key → chosen state (seeded from the bransch preset; booking floored on read). */
  moduleStates: Record<string, ModuleState>
  /** accent hex ('' = none picked → theme's own primary wins). */
  accent: string
  tagline: string
  /** Hero copy (W5) → settings.copy. heroTitle = the hero headline (rubrik), heroLede =
   *  the hero supporting paragraph (ingress). Empty → the theme's own default copy wins
   *  (resolveThemeContent per-field override). NOT the footer tagline (that's `tagline`). */
  heroTitle: string
  heroLede: string
  /** onboarding services (W4) → services rows on Lansera. Empty allowed (operator can
   *  add them later in admin); a booking-active tenant needs ≥1 to actually be bookable
   *  (bookings.service_id is NOT NULL). */
  services: StudioService[]
  ownerName: string
  ownerEmail: string
}

/** Fresh studio config: no bransch, empty fields, the given default theme/variant. */
export function initStudioCfg(
  defaultTheme: string,
  variant: BookingVariant = DEFAULT_BOOKING_VARIANT,
): StudioCfg {
  return {
    branch: null,
    name: '',
    slug: '',
    slugTouched: false,
    theme: defaultTheme,
    variant,
    moduleStates: {},
    accent: '',
    tagline: '',
    heroTitle: '',
    heroLede: '',
    services: [],
    ownerName: '',
    ownerEmail: '',
  }
}

/**
 * Pick a bransch: set it, prefill the theme from the bransch's default_template (else
 * its first bransch-filtered template, else keep the current theme), and seed the
 * per-module states from the preset. Unknown key → only the branch is set (mirrors
 * chooseVertical's early return). Operator can still override theme + modules after.
 */
export function applyBranch(cfg: StudioCfg, verticalKey: string, presets: VerticalPresetData): StudioCfg {
  const v = presets.verticals.find((x) => x.key === verticalKey)
  if (!v) return { ...cfg, branch: verticalKey }
  const branschTemplates = presets.templatesByVertical[verticalKey] ?? []
  const theme = v.defaultTemplate ?? branschTemplates[0]?.key ?? cfg.theme
  const moduleStates: Record<string, ModuleState> = {}
  for (const m of modulesForVertical(presets, verticalKey)) moduleStates[m.key] = m.defaultState
  return { ...cfg, branch: verticalKey, theme, moduleStates }
}

/**
 * The effective state of a module: explicit pick → preset default → 'off'. booking can
 * never read below 'live' (the platform floor) unless explicitly 'paused'.
 */
export function resolveModuleState(
  cfg: StudioCfg,
  key: string,
  presets: VerticalPresetData,
): ModuleState {
  const picked = cfg.moduleStates[key]
  const preset = modulesForVertical(presets, cfg.branch).find((m) => m.key === key)?.defaultState ?? 'off'
  const resolved = picked ?? preset
  return key === 'booking' && resolved !== 'live' && resolved !== 'paused' ? 'live' : resolved
}

/** name → a clean storefront slug (a–z, 0–9, dash) — mirrors CreateTenantForm.slugify. */
export function studioSlugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
