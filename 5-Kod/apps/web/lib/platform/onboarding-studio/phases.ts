// Onboarding-studio (goal-48) — static step-rail config for the three phases and
// seven steps. FLAT_STEP_ORDER drives navigation; stepDone derives completion from
// the real StudioCfg.
import type { IconName } from '@/components/portal/ui/Icon'
import type { StudioCfg } from './model'
import { resolveModuleState } from './model'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import { normalizeBookingExternalUrl } from '@/lib/platform/booking-external-url'

/** The step ids, in flow order (the StepId string-union the leaves narrow on). */
// modplace/modconf borttagna 2026-07-11 (Dunder-fix). text→brand och granska→live
// ihopslagna 2026-07-11 (UX-order: "lättare steg för steg, hjärndött") — 8 steg.
// 'brand' + 'tjanster' borttagna 2026-07-11 (Zivar: "onboardingen ska inte ha steg där
// jag skriver in tjänster eller rubriker — det ska vara superlätt att komma igång").
// Rubriker/ingress kommer från BRANSCHENS mall-text (verticals.default_copy, goal-57
// K12) och mallens egen evergreen-copy; tjänster + accent/logga läggs upp i kundens
// admin efteråt, där de hör hemma. Kvar: 7 steg inklusive bokningsleverantör.
export type StepId =
  | 'branch'
  | 'namn'
  | 'tema'
  | 'modval'
  | 'bokning'
  | 'agare'
  | 'live'

/** One step in a phase. `req:true` = required before Skapa (branch/namn/tema/ägare/live).
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
 * Three phases and seven steps. Data, not behaviour: presets and themes own the
 * actual tenant defaults; this list only orders and names the steps.
 */
export const PHASES: StudioPhase[] = [
  {
    id: 'grund',
    name: 'Grunden',
    sub: 'Bransch, namn, mall — resten förfylls',
    steps: [
      { id: 'branch', label: 'Bransch', icon: 'building', req: true, hint: 'Förfyller mall, moduler & ord' },
      { id: 'namn', label: 'Namn & subdomän', icon: 'link', req: true, hint: 'tenants.slug → <slug>.boka.corevo.se' },
      { id: 'tema', label: 'Temamall', icon: 'palette', req: true, hint: 'Förvald av branschen — byt fritt' },
    ],
  },
  {
    id: 'innehall',
    name: 'Innehåll',
    sub: 'Moduler — förvalda av branschen',
    steps: [
      { id: 'modval', label: 'Moduler', icon: 'layers', req: false, hint: 'Förvalda per bransch' },
      { id: 'bokning', label: 'Bokning', icon: 'calendar', req: false, hint: 'Corevo eller extern leverantör' },
    ],
  },
  {
    id: 'lansera',
    name: 'Klart',
    sub: 'Ägare, sista koll, live',
    steps: [
      { id: 'agare', label: 'Ägare & inbjudan', icon: 'user', req: true, hint: 'Magic-link → eget lösen' },
      { id: 'live', label: 'Granska & skapa', icon: 'rocket', req: true, hint: 'Skapa under konfiguration' },
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
 *   modval  → at least one module is on
 *   agare   → an owner email is filled
 *   bokning → off is complete; live external requires a valid HTTPS URL
 *   live    → never a checkmark because it is the submit step
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
        return st === 'live'
      })
    case 'bokning':
      if (resolveModuleState(cfg, 'booking', presets) === 'off') return true
      return cfg.bookingProvider === 'corevo' || normalizeBookingExternalUrl(cfg.bookingExternalUrl) !== null
    case 'agare':
      return !!cfg.ownerEmail
    case 'live':
      return false
    default: {
      const _exhaustive: never = stepId
      return _exhaustive
    }
  }
}
