import 'server-only'
// Vertical (bransch) PRESET layer (multi-bransch spår 5) — reads the platform
// `verticals` catalog so the onboarding wizard can lead with "Välj bransch" and
// prefill the template + module-state preset for the chosen vertical.
//
// Contract (00-plan-index.md, ordagrant):
//   verticals(key, name, default_modules{module:state}, default_template, terminology, rules)
//   modules(key, name, default_section_position, …)
// A vertical is a PRESET/etikett, NOT a lock — the operator can still toggle any
// module on/off in the wizard's "Moduler" step. The preset only seeds sensible
// defaults (e.g. frisör → booking:live, loyalty:draft, shop:off, template 'salvia').
//
// This module is server-only (uses the authed platform client via platformCtx in the
// caller). The wizard is a client component, so a server component (the /salonger/ny
// page) calls loadVerticalPresets() and passes the plain JSON down as props.
import { platformCtx } from './guard'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'

/** A selectable module in the wizard's "Moduler" step (catalog row + preset state). */
export type ModuleOption = {
  key: string
  name: string
  /** Preset state for the CURRENTLY selected vertical (off/draft/live/paused). */
  defaultState: ModuleState
}

/** One bransch the operator can pick in wizard step 0. Carries everything the wizard
 *  needs to prefill: template, terminology label, and the per-module preset states. */
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

/** One selectable template (mall) in the wizard's "Temamall" step. The catalog row
 *  reduced to what the picker needs: the key (→ settings.theme) + display name. */
export type TemplateOption = {
  key: string
  name: string
}

/** Everything the wizard needs to render the bransch + moduler steps, fetched once. */
export type VerticalPresetData = {
  /** All active branscher (verticals catalog), name-sorted. May be empty. */
  verticals: VerticalPreset[]
  /** All modules in the catalog (with a neutral 'off' default), name-sorted. */
  modules: { key: string; name: string }[]
  /** Active templates grouped by tags.bransch (→ vertical key). The wizard's
   *  "Temamall" step lists templatesByVertical[verticalKey] and falls back to its
   *  built-in theme list when a bransch has no templates seeded yet. Empty when the
   *  templates table is empty/unreadable (wizard then uses its built-in list). */
  templatesByVertical: Record<string, TemplateOption[]>
}

function parseState(raw: unknown, fallback: ModuleState = 'off'): ModuleState {
  return (MODULE_STATES as readonly string[]).includes(raw as string) ? (raw as ModuleState) : fallback
}

/** Coerce a jsonb `default_modules` value into a clean { key: state } map. */
function parseDefaultModules(raw: unknown): Record<string, ModuleState> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, ModuleState> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && (MODULE_STATES as readonly string[]).includes(v)) {
      out[k] = v as ModuleState
    }
  }
  return out
}

/** Coerce a jsonb `terminology` value into a clean { key: label } map (strings only). */
function parseTerminology(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim().length > 0) out[k] = v
  }
  return out
}

/** Read `tags.bransch` (the vertical key a template is tagged for) off a template's
 *  jsonb `tags`. Returns null when absent/non-string so the template is simply not
 *  grouped under any bransch (the wizard then never lists it for a bransch). */
function parseTemplateBransch(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const b = (raw as Record<string, unknown>).bransch
  return typeof b === 'string' && b.trim().length > 0 ? b : null
}

/**
 * Load the verticals + modules catalog for the onboarding wizard. Platform-gated
 * (platformCtx → authed admin client, RLS read-allowed for the catalog tables).
 * Returns empty arrays on any error so the wizard degrades to "no preset" (the
 * operator can still pick modules manually) rather than crashing onboarding.
 */
export async function loadVerticalPresets(): Promise<VerticalPresetData> {
  const { supabase } = await platformCtx()

  const [{ data: vRows }, { data: mRows }, { data: tRows }] = await Promise.all([
    supabase
      .from('verticals')
      .select('key, name, default_template, default_modules, terminology')
      .order('name', { ascending: true }),
    supabase.from('modules').select('key, name').order('name', { ascending: true }),
    // Active templates only — the wizard lists what the operator can actually pick
    // (mirrors the templates_read_active RLS intent). Grouped by tags.bransch below.
    supabase
      .from('templates')
      .select('key, name, tags')
      .eq('status', 'active')
      .order('name', { ascending: true }),
  ])

  const verticals: VerticalPreset[] = (vRows ?? []).map((r) => ({
    key: r.key,
    name: r.name,
    defaultTemplate: typeof r.default_template === 'string' ? r.default_template : null,
    defaultModules: parseDefaultModules(r.default_modules),
    terminology: parseTerminology(r.terminology),
  }))

  const modules = (mRows ?? []).map((r) => ({ key: r.key, name: r.name }))

  // Group active templates under their tags.bransch (→ vertical key). Untagged
  // templates are skipped (the wizard lists per-bransch; an untagged mall has no
  // bransch to appear under). Empty map → wizard falls back to its built-in list.
  const templatesByVertical: Record<string, TemplateOption[]> = {}
  for (const r of tRows ?? []) {
    const bransch = parseTemplateBransch(r.tags)
    if (!bransch || typeof r.key !== 'string' || typeof r.name !== 'string') continue
    ;(templatesByVertical[bransch] ??= []).push({ key: r.key, name: r.name })
  }

  return { verticals, modules, templatesByVertical }
}

/**
 * Resolve the module options for a chosen vertical: every catalog module, annotated
 * with the preset state for that vertical (defaulting to 'off' when the vertical's
 * preset does not mention it). `booking` is floored to at least 'draft' in the preset
 * here is NOT done — the wizard enforces "booking minst live" in its UI/validation;
 * this function only reports the raw preset so the wizard stays the single source of
 * that rule. When `verticalKey` is null (no bransch picked), all default to 'off'
 * EXCEPT booking which presets to 'live' (the platform's baseline product).
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
