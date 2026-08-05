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
  | 'start'
  | 'setup'
  | 'content'
  | 'site'
  | 'domain'
  | 'review'

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
    id: 'start',
    name: 'Start',
    sub: 'Kundtyp och viktigaste uppgifter',
    steps: [
      { id: 'start', label: 'Starta kund', icon: 'user', req: true, hint: 'Namn, kontakt och arbetssätt' },
    ],
  },
  {
    id: 'setup',
    name: 'Setup',
    sub: 'Bransch, mall och moduler',
    steps: [
      { id: 'setup', label: 'Bransch & mall', icon: 'layers', req: true, hint: 'Kategori, template och aktiva moduler' },
    ],
  },
  {
    id: 'content',
    name: 'Innehåll',
    sub: 'Det som kan förberedas',
    steps: [
      { id: 'content', label: 'Tjänster & data', icon: 'calendar', req: false, hint: 'Tjänster, personal, bilder och produkter' },
    ],
  },
  {
    id: 'site',
    name: 'Sida',
    sub: 'Mallens innehåll och känsla',
    steps: [
      { id: 'site', label: 'Redigera sida', icon: 'palette', req: false, hint: 'Startcopy, accent och live-preview' },
    ],
  },
  {
    id: 'domain',
    name: 'Domän',
    sub: 'Subdomän och extern driftcheck',
    steps: [
      { id: 'domain', label: 'Subdomän & CF', icon: 'globe', req: true, hint: 'Adress och manuell Cloudflare-check' },
    ],
  },
  {
    id: 'review',
    name: 'Review',
    sub: 'Förhandsgranska och skapa',
    steps: [
      { id: 'review', label: 'Granska & skapa', icon: 'rocket', req: true, hint: 'Klarhetsgrad, checklistor och skapande' },
    ],
  },
]

/** Flat step order for prev/next navigation (PHASES.flatMap of step ids). */
export const FLAT_STEP_ORDER: StepId[] = PHASES.flatMap((p) => p.steps.map((s) => s.id))

export function visiblePhases(cfg: StudioCfg, presets: VerticalPresetData): StudioPhase[] {
  void cfg
  void presets
  return PHASES
    .filter((phase) => phase.steps.length > 0)
}

export function visibleStepOrder(cfg: StudioCfg, presets: VerticalPresetData): StepId[] {
  return visiblePhases(cfg, presets).flatMap((phase) => phase.steps.map((step) => step.id))
}

/**
 * PURE per-step "done" derivation from the REAL StudioCfg (build-contract §4):
 *   start   → customer name and owner email exist
 *   setup   → branch + theme exist
 *   content → optional; any service is enough to mark prepared
 *   site    → optional; theme exists
 *   domain  → slug exists
 *   review  → never a checkmark because it is the submit step
 */
export function stepDone(stepId: StepId, cfg: StudioCfg, presets: VerticalPresetData): boolean {
  switch (stepId) {
    case 'start':
      return !!cfg.name.trim() && !!cfg.ownerEmail.trim()
    case 'setup':
      if (!cfg.branch || !cfg.theme) return false
      if (resolveModuleState(cfg, 'booking', presets) === 'off') return true
      return !!cfg.branch && !!cfg.theme && (cfg.bookingProvider === 'corevo' || normalizeBookingExternalUrl(cfg.bookingExternalUrl) !== null)
    case 'content':
      return cfg.services.some((service) => service.name.trim() !== '')
    case 'site':
      return !!cfg.theme
    case 'domain':
      return !!cfg.slug
    case 'review':
      return false
    default: {
      const _exhaustive: never = stepId
      return _exhaustive
    }
  }
}
