// Onboarding-studio — step-rail config. Navigation can filter steps from
// the real StudioCfg; stepDone derives completion from the same cfg.
import type { IconName } from '@/lib/ui-icons'
import type { StudioCfg } from './model'
import { resolveModuleState } from './model'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import { normalizeBookingExternalUrl } from '@/lib/platform/booking-external-url'

/** The step ids, in flow order (the StepId string-union the leaves narrow on). */
// Branschen sätter mall och modul-förval. Tjänster, logga, moduler och mall ändras i
// kundkortet efter skapandet, där de har en verklig skrivväg och förhandsvisning.
export type StepId =
  | 'branch'
  | 'namn'
  | 'modules'
  | 'bokning'
  | 'appearance'
  | 'live'

/** One step in a phase. `req:true` = required before Skapa.
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
 * Three phases and available steps. Data, not behaviour: presets and themes own the
 * actual tenant defaults; this list only orders and names the steps.
 */
export const PHASES: StudioPhase[] = [
  {
    id: 'grund',
    name: 'Grunden',
    sub: 'Bransch, namn, mall — resten förfylls',
    steps: [
      { id: 'branch', label: 'Bransch', icon: 'building', req: true, hint: 'Förfyller mall, moduler & ord' },
      { id: 'namn', label: 'Namn & subdomän', icon: 'link', req: true, hint: 'tenants.slug → <slug>.corevo.se' },
    ],
  },
  {
    id: 'innehall',
    name: 'Innehåll',
    sub: 'Moduler, bokning och startcopy',
    steps: [
      { id: 'modules', label: 'Moduler', icon: 'layers', req: false, hint: 'Välj bara moduler kunden använder' },
      { id: 'bokning', label: 'Bokning', icon: 'calendar', req: false, hint: 'Corevo eller extern leverantör' },
      { id: 'appearance', label: 'Utseende', icon: 'palette', req: false, hint: 'Startcopy och accent' },
    ],
  },
  {
    id: 'lansera',
    name: 'Klart',
    sub: 'Ägare, sista koll och skapa',
    steps: [
      { id: 'live', label: 'Ägare & skapa', icon: 'rocket', req: true, hint: 'Magic-link → eget lösen, skapa under konfiguration' },
    ],
  },
]

/** Flat step order for prev/next navigation (PHASES.flatMap of step ids). */
export const FLAT_STEP_ORDER: StepId[] = PHASES.flatMap((p) => p.steps.map((s) => s.id))

export function visiblePhases(cfg: StudioCfg, presets: VerticalPresetData): StudioPhase[] {
  const bookingVisible = resolveModuleState(cfg, 'booking', presets) !== 'off'
  return PHASES
    .map((phase) => ({
      ...phase,
      steps: phase.steps.filter((step) => step.id !== 'bokning' || bookingVisible),
    }))
    .filter((phase) => phase.steps.length > 0)
}

export function visibleStepOrder(cfg: StudioCfg, presets: VerticalPresetData): StepId[] {
  return visiblePhases(cfg, presets).flatMap((phase) => phase.steps.map((step) => step.id))
}

/**
 * PURE per-step "done" derivation from the REAL StudioCfg (build-contract §4):
 *   branch  → a bransch is picked
 *   namn    → a slug exists
 *   modules → a bransch is picked so defaults are loaded
 *   bokning → off is complete; live external requires a valid HTTPS URL
 *   appearance → optional; theme exists
 *   live    → never a checkmark because it is the submit step
 */
export function stepDone(stepId: StepId, cfg: StudioCfg, presets: VerticalPresetData): boolean {
  switch (stepId) {
    case 'branch':
      return !!cfg.branch
    case 'namn':
      return !!cfg.slug
    case 'modules':
      return !!cfg.branch
    case 'bokning':
      if (resolveModuleState(cfg, 'booking', presets) === 'off') return true
      return cfg.bookingProvider === 'corevo' || normalizeBookingExternalUrl(cfg.bookingExternalUrl) !== null
    case 'appearance':
      return !!cfg.theme
    case 'live':
      return false
    default: {
      const _exhaustive: never = stepId
      return _exhaustive
    }
  }
}
