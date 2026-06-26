// Onboarding-studio (goal-48) — STEP RAIL config: the 5-phase / 12-step spine.
//
// Ported VERBATIM from the design data spine (4-Dokument-Underlag/01-acceptans/
// super-admin/cfg-data.js, the PHASES const ~:303–331) per W1 build-contract §4.
// This is STATIC config, NOT DB. The phase header renders `{pi+1}. {phase.name}`;
// `phase.sub` + per-step `hint` are data-present (verbatim) but NOT rendered in the
// rail (the rail shows label + status bullet + required dot). FLAT_STEP_ORDER drives
// the Föregående/Nästa flow. `stepDone` derives each step's checkmark from the REAL
// StudioCfg (model.ts) — see §4's per-step done-derivation.
import type { IconName } from '@/components/portal/ui/Icon'
import type { StudioCfg } from './model'
import { resolveModuleState } from './model'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'

/** The 12 step ids, in flow order (the StepId string-union the leaves narrow on). */
export type StepId =
  | 'branch'
  | 'namn'
  | 'tema'
  | 'modval'
  | 'modplace'
  | 'modconf'
  | 'brand'
  | 'text'
  | 'tjanster'
  | 'agare'
  | 'granska'
  | 'live'

/** One step in a phase. `req:true` = required before Lansera (branch/namn/tema/live).
 *  `hint` is verbatim design data (additive over the documented {id,label,icon,req});
 *  it is NOT rendered in the W1 rail but kept so a later wave can surface it. */
export type StudioStep = {
  id: StepId
  label: string
  icon: IconName
  req: boolean
  hint: string
}

/** One phase (a group of steps). `sub` is verbatim design data, NOT rendered in the
 *  rail (the header renders only `{index+1}. {name}`). */
export type StudioPhase = {
  id: string
  name: string
  sub: string
  steps: StudioStep[]
}

/**
 * The 5 phases / 12 steps — verbatim copy of cfg-data.js PHASES (labels, icons, req,
 * hints, subs incl. å/ä/ö). DATA, not behaviour: the studio renders whatever the REAL
 * presets/themes contain; this only orders + names the steps.
 */
export const PHASES: StudioPhase[] = [
  {
    id: 'grund',
    name: 'Grunden',
    sub: 'Det som måste sitta först',
    steps: [
      { id: 'branch', label: 'Bransch', icon: 'building', req: true, hint: 'Styr moduler, ord & innehåll' },
      { id: 'namn', label: 'Namn & subdomän', icon: 'link', req: true, hint: 'tenants.slug → <slug>.corevo.se' },
      { id: 'tema', label: 'Temamall', icon: 'palette', req: true, hint: 'Ett av 6 byggda teman' },
    ],
  },
  {
    id: 'moduler',
    name: 'Moduler',
    sub: 'Det som gör sidan till deras',
    steps: [
      { id: 'modval', label: 'Välj moduler', icon: 'layers', req: false, hint: 'Föraktiverade per bransch' },
      { id: 'modplace', label: 'Placera & ordna', icon: 'grid', req: false, hint: 'Dra till sektion, ordna' },
      { id: 'modconf', label: 'Modulinställningar', icon: 'settings', req: false, hint: 'Bransch-specifika fält' },
    ],
  },
  {
    id: 'innehall',
    name: 'Innehåll & utseende',
    sub: 'Texten, färgen, känslan',
    steps: [
      { id: 'brand', label: 'Branding', icon: 'sun', req: false, hint: 'Logga, accentfärg, font' },
      { id: 'text', label: 'Text & hjälte', icon: 'edit', req: false, hint: 'Klicka & skriv direkt i previewen' },
      { id: 'tjanster', label: 'Tjänster & innehåll', icon: 'scissors', req: false, hint: 'Datat modulerna visar' },
    ],
  },
  {
    id: 'konto',
    name: 'Ägare & konto',
    sub: 'Vem som styr sidan',
    steps: [
      { id: 'agare', label: 'Ägare & inbjudan', icon: 'user', req: false, hint: 'Magic-link → eget lösen' },
    ],
  },
  {
    id: 'lansera',
    name: 'Granska & lansera',
    sub: 'Sista koll, sen live',
    steps: [
      { id: 'granska', label: 'Granska checklista', icon: 'checkCircle', req: false, hint: 'Onboarding-checklistan' },
      { id: 'live', label: 'Lansera', icon: 'rocket', req: true, hint: 'Publicera på subdomän' },
    ],
  },
]

/** Flat step order for prev/next navigation (PHASES.flatMap of step ids). */
export const FLAT_STEP_ORDER: StepId[] = PHASES.flatMap((p) => p.steps.map((s) => s.id))

/**
 * PURE per-step "done" derivation from the REAL StudioCfg (build-contract §4):
 *   branch  → a bransch is picked
 *   namn    → a slug exists
 *   tema    → a theme is set (always truthy — theme defaults to the built-in default)
 *   modval  → at least one module resolves to live/draft (booking floors to live)
 *   agare   → an owner email is filled
 *   tjanster→ at least one service with a non-empty name (W4; matches design's
 *             cfg.content.services.length > 0 launch gate)
 *   modplace/modconf/brand/text/granska/live → never a checkmark (matches design)
 */
export function stepDone(stepId: StepId, cfg: StudioCfg, presets: VerticalPresetData): boolean {
  switch (stepId) {
    case 'branch':
      return !!cfg.branch
    case 'namn':
      return !!cfg.slug
    case 'tema':
      return !!cfg.theme
    case 'modval':
      return presets.modules.some((m) => {
        const st = resolveModuleState(cfg, m.key, presets)
        return st === 'live' || st === 'draft'
      })
    case 'agare':
      return !!cfg.ownerEmail
    case 'tjanster':
      return cfg.services.some((s) => s.name.trim() !== '')
    case 'modplace':
    case 'modconf':
    case 'brand':
    case 'text':
    case 'granska':
    case 'live':
      return false
    default: {
      const _exhaustive: never = stepId
      return _exhaustive
    }
  }
}
