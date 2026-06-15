import 'server-only'
// Vertical (bransch) PRESET layer (multi-bransch spår 5) — SERVER DB-fetch only.
// Reads the platform `verticals`/`modules`/`templates` catalog so the onboarding
// wizard can lead with "Välj bransch" and prefill the template + module-state preset.
//
// Client-safe types + the pure `modulesForVertical` helper live in ./verticals-shared
// (imported by the client wizard). This file is server-only (uses platformCtx); a
// server component (/salonger/ny) calls loadVerticalPresets() and passes the plain
// JSON down to the client wizard as props.
import { platformCtx } from './guard'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'
import type {
  VerticalPreset,
  TemplateOption,
  VerticalPresetData,
} from './verticals-shared'

// Re-export the client-safe surface so existing SERVER importers can keep importing
// the types + modulesForVertical from '@/lib/platform/verticals'. (Client code must
// import these from './verticals-shared' directly — importing them from here would
// pull this module's `server-only` marker into the client bundle.)
export type {
  ModuleOption,
  VerticalPreset,
  TemplateOption,
  VerticalPresetData,
} from './verticals-shared'
export { modulesForVertical } from './verticals-shared'

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
 *  jsonb `tags`. Returns null when absent/non-string so it is simply not grouped. */
function parseTemplateBransch(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const b = (raw as Record<string, unknown>).bransch
  return typeof b === 'string' && b.trim().length > 0 ? b : null
}

/**
 * Load the verticals + modules + templates catalog for the onboarding wizard.
 * Platform-gated (platformCtx → authed admin client, RLS read-allowed for the catalog
 * tables). Returns empty arrays on any error so the wizard degrades to "no preset"
 * (operator can still pick modules manually) rather than crashing onboarding.
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
    // (mirrors templates_read_active RLS). Grouped by tags.bransch below.
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
  // templates are skipped. Empty map → wizard falls back to its built-in theme list.
  const templatesByVertical: Record<string, TemplateOption[]> = {}
  for (const r of tRows ?? []) {
    const bransch = parseTemplateBransch(r.tags)
    if (!bransch || typeof r.key !== 'string' || typeof r.name !== 'string') continue
    ;(templatesByVertical[bransch] ??= []).push({ key: r.key, name: r.name })
  }

  return { verticals, modules, templatesByVertical }
}
