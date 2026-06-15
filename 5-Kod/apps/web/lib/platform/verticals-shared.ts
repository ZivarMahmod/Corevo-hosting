// Client-safe vertical (bransch) preset types + pure helper (multi-bransch spår 5).
// NO 'server-only' — imported by the CLIENT onboarding wizard (CreateTenantForm).
// The server DB-fetch (loadVerticalPresets) lives in ./verticals (server-only).
import type { ModuleState } from '@/lib/tenant-modules'

/** A selectable module in the wizard's "Moduler" step (catalog row + preset state). */
export type ModuleOption = {
  key: string
  name: string
  /** Preset state for the CURRENTLY selected vertical (off/draft/live/paused). */
  defaultState: ModuleState
}

/** One bransch the operator can pick in wizard step 0. Carries template + per-module
 *  preset states + terminology so the wizard can prefill the chosen bransch. */
export type VerticalPreset = {
  key: string
  name: string
  /** Template key this bransch defaults to (→ settings.theme). null = leave default. */
  defaultTemplate: string | null
  /** module_key → preset state for this bransch (from verticals.default_modules). */
  defaultModules: Record<string, ModuleState>
  /** terminology overlay (e.g. { staff:'Stylist', service:'Klippning' }) — labels. */
  terminology: Record<string, string>
}

/** One selectable template (mall) in the wizard's "Temamall" step. */
export type TemplateOption = { key: string; name: string }

/** Everything the wizard needs to render the bransch + moduler steps, fetched once. */
export type VerticalPresetData = {
  verticals: VerticalPreset[]
  modules: { key: string; name: string }[]
  /** Active templates grouped by tags.bransch (→ vertical key). Empty → wizard uses
   *  its built-in theme list as fallback. */
  templatesByVertical: Record<string, TemplateOption[]>
}

/**
 * Resolve the module options for a chosen vertical: every catalog module annotated
 * with its preset state for that vertical (default 'off', except booking → 'live'
 * when no bransch is picked). PURE — safe in both client and server. The wizard
 * enforces "booking minst live" in its own UI; this only reports the raw preset.
 */
export function modulesForVertical(
  data: VerticalPresetData,
  verticalKey: string | null,
): ModuleOption[] {
  const preset = verticalKey ? data.verticals.find((v) => v.key === verticalKey) : undefined
  return data.modules.map((m) => {
    const presetState = preset?.defaultModules[m.key]
    const fallback: ModuleState = m.key === 'booking' ? 'live' : 'off'
    return { key: m.key, name: m.name, defaultState: presetState ?? fallback }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminologi (bransch-etiketter) — multi-bransch Fas 4.
// PURE — safe in BOTH client and server (no 'server-only'). The same overlay the
// onboarding wizard prefills (verticals.terminology, e.g. { staff:'Stylist',
// service:'Klippning' }) is resolved into UI labels here so admin surfaces speak
// the tenant's bransch instead of the generic platform default.
// ─────────────────────────────────────────────────────────────────────────────

/** A vertical's label overlay: terminology key → bransch noun (singular, stored
 *  capitalized). Keys in use today: 'staff', 'service', 'unit'. Operators may add
 *  '<key>_plural' entries (e.g. 'staff_plural') to drive {@link termPlural}. */
export type Terminology = Record<string, string>

/** Generic Swedish singular fallbacks per terminology key — used ONLY when the
 *  vertical has no override AND the call site passes no explicit fallback. Neutral
 *  platform defaults, never bransch-guesses. */
const TERMINOLOGY_DEFAULTS: Record<string, string> = {
  staff: 'Personal',
  service: 'Tjänst',
  unit: 'Resurs',
}

/** Coerce a raw jsonb `terminology` value into a clean { key: label } map (strings
 *  only, trimmed, empty dropped). Mirrors the server parser in ./verticals so the
 *  admin tenant-loader and the wizard agree on what a valid overlay is. */
export function cleanTerminology(raw: unknown): Terminology {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Terminology = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim().length > 0) out[k] = v.trim()
  }
  return out
}

/**
 * Resolve ONE singular terminology label. Precedence, first non-empty wins:
 *   1. the vertical's override   (terminology[key])
 *   2. the call site's fallback  (the existing hardcoded Swedish word)
 *   3. the generic default       (TERMINOLOGY_DEFAULTS[key])
 *   4. the key itself            (last resort — never returns blank)
 *
 * The fallback-before-default order is the safety net: every wired call passes its
 * current label, so a tenant with no override (or the 'generell' bransch) renders
 * EXACTLY today's text — wiring a surface can never regress it, only specialise it.
 * NEVER inflects — a plural/possessive surface must use {@link termPlural}.
 */
export function resolveTerm(
  terminology: Terminology | null | undefined,
  key: string,
  fallback?: string,
): string {
  const override = terminology?.[key]
  if (typeof override === 'string' && override.trim().length > 0) return override.trim()
  if (fallback && fallback.trim().length > 0) return fallback
  return TERMINOLOGY_DEFAULTS[key] ?? key
}

/**
 * Resolve a PLURAL/collective label WITHOUT guessing Swedish inflection. Reads a
 * dedicated `<key>_plural` overlay entry if the vertical declares one; otherwise
 * returns the call site's existing plural fallback unchanged. Swedish plurals are
 * irregular (Stylist→Stylister, Klippning→Klippningar, Rätt→Rätter, Barberare→
 * Barberare) so we never derive them — a surface stays on its current word until an
 * operator adds the explicit `*_plural` key to verticals.terminology.
 */
export function termPlural(
  terminology: Terminology | null | undefined,
  key: string,
  fallbackPlural: string,
): string {
  const override = terminology?.[`${key}_plural`]
  if (typeof override === 'string' && override.trim().length > 0) return override.trim()
  return fallbackPlural
}

/** Bind a tenant's terminology once → a `term(key, fallback)` closure for a render
 *  pass (mirrors the inline helper in CreateTenantForm). Pure; safe in a client
 *  component too (the overlay is a plain serialisable object). */
export function makeTerm(
  terminology: Terminology | null | undefined,
): (key: string, fallback?: string) => string {
  return (key, fallback) => resolveTerm(terminology, key, fallback)
}
