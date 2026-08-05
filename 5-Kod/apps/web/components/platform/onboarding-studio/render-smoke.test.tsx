// goal-48 W1 — RENDER smoke test. tsc/vitest-logic/opennext-build prove types,
// reducer logic and bundling; NONE of them MOUNT a component (curl's 307 fires in
// middleware, before the page renders). This file executes the real design-JSX path:
// each leaf + all 12 panels (via PanelHost over FLAT_STEP_ORDER) + the root machine
// are server-rendered with mock props. A component can bundle clean and still throw on
// mount (bad hook wiring, a null prop access, a broken registry lookup) — this catches
// that. Pure render proof; no auth, no DB, no network. (The authenticated visual + the
// live Lansera DB write stay with Zivar — see goal doc.)
import type { Dispatch } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'

// OnboardingStudio imports the createTenant server action — stub it so the module
// imports cleanly in the node test env (we only smoke its RENDER, not the write).
vi.mock('@/lib/platform/actions/tenants', () => ({ createTenant: async () => ({}) }))

// W2: PreviewPane now mounts the REAL storefront layout; Bookable inside it calls
// useRouter (next/navigation) — stub it so the node render env doesn't throw.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/',
}))

import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import { initStudioCfg, applyBranch } from '@/lib/platform/onboarding-studio/model'
import type { StudioAction, StudioStage } from '@/lib/platform/onboarding-studio/state'
import { FLAT_STEP_ORDER, PHASES } from '@/lib/platform/onboarding-studio/phases'
import { JourneyBar } from './JourneyBar'
import { StepRail } from './StepRail'
import { PanelHost } from './PanelHost'
import { PreviewPane } from './PreviewPane'
import { OnboardingStudio, ResultView } from './OnboardingStudio'

// Minimal real-shaped presets (same as state.test.ts — VerticalPreset has no
// hero/services/defaultPos).
const presets: VerticalPresetData = {
  verticals: [
    {
      key: 'frisor',
      name: 'Frisörsalong',
      defaultTemplate: 'kalla',
      defaultModules: { booking: 'live', lojalitet: 'off', shop: 'off' },
      terminology: { service: 'Behandling', staff: 'Stylist' },
    },
    { key: 'generell', name: 'Generell', defaultTemplate: null, defaultModules: {}, terminology: {} },
  ],
  modules: [
    { key: 'booking', name: 'Bokning' },
    { key: 'media_library', name: 'Bildbibliotek' },
    { key: 'lojalitet', name: 'Lojalitet' },
    { key: 'shop', name: 'Webshop' },
    { key: 'kurser', name: 'Kurser' },
  ],
  templatesByVertical: { frisor: [{ key: 'kalla', name: 'Källa' }], generell: [{ key: 'edit', name: 'Edit' }] },
}

const noopDispatch = (() => {}) as Dispatch<StudioAction>
const noop = () => {}

// A cfg with a bransch applied → branch/tema/modval panels have real preset data.
const branched = applyBranch(initStudioCfg('salvia'), 'frisor', presets)
const fresh = initStudioCfg('salvia')
// W4: a cfg with a typed service → tjanster panel rows + live preview reflect it.
const withServices = { ...branched, services: [{ name: 'Klippning', price: '350' }] }
const allSteps = FLAT_STEP_ORDER

/** Render and assert it produced real (non-trivial) markup without throwing. */
function mounts(node: React.ReactElement): string {
  const html = renderToStaticMarkup(node)
  expect(html.length).toBeGreaterThan(20)
  return html
}

describe('W1 studio — render smoke (mounts without throwing)', () => {
  it('JourneyBar mounts (studio + result pills; super-entrén är borttagen)', () => {
    const reachable: Record<StudioStage, boolean> = { super: false, studio: true, result: false }
    const html = mounts(<JourneyBar stage="studio" reachable={reachable} onNav={noop} />)
    expect(html).toContain('Kundstart')
    expect(html).not.toContain('Onboarding-studio')
    expect(html).not.toContain('>Kunder<') // gamla entré-pillen ska inte återuppstå
  })

  it('StepRail mounts with the booking provider step', () => {
    const html = mounts(<StepRail cfg={branched} step="start" onStep={noop} presets={presets} />)
    expect(html).toContain('Starta kund')
  })

  it('PreviewPane mounts the real themed storefront render (W2)', () => {
    const html = mounts(<PreviewPane cfg={branched} device="desktop" onDevice={noop} />)
    expect(html).toContain('data-world="storefront"') // real storefront render, not a skeleton
  })

  it('PanelHost mounts every onboarding step (branched cfg)', () => {
    for (const step of FLAT_STEP_ORDER) {
      const html = mounts(
        <PanelHost
          cfg={branched}
          step={step}
          stepOrder={allSteps}
          dispatch={noopDispatch}
          presets={presets}
          onPrev={noop}
          onNext={noop}
          onLaunch={noop}
        />,
      )
      expect(html, `step ${step} rendered empty`).toBeTruthy()
    }
  })

  it('PanelHost mounts every step on a FRESH cfg (no bransch picked)', () => {
    for (const step of FLAT_STEP_ORDER) {
      mounts(
        <PanelHost
          cfg={fresh}
          step={step}
          stepOrder={allSteps}
          dispatch={noopDispatch}
          presets={presets}
          onPrev={noop}
          onNext={noop}
          onLaunch={noop}
        />,
      )
    }
  })

  it('the booking step shows Corevo and external provider choices', () => {
    const html = mounts(
      <PanelHost cfg={branched} step="setup" stepOrder={allSteps} dispatch={noopDispatch} presets={presets} onPrev={noop} onNext={noop} onLaunch={noop} />,
    )
    expect(html).toContain('Corevo-bokning')
    expect(html).toContain('Extern bokning')
    expect(html).toContain('Bokningssätt')
  })

  it('the booking step requires a valid external https URL', () => {
    const html = mounts(
      <PanelHost
        cfg={{ ...branched, bookingProvider: 'external', bookingExternalUrl: 'http://fel.test' }}
        step="setup"
        stepOrder={allSteps}
        dispatch={noopDispatch}
        presets={presets}
        onPrev={noop}
        onNext={noop}
        onLaunch={noop}
      />,
    )
    expect(html).toContain('Ange en fullständig https-länk.')
    expect(html).toContain('aria-invalid="true"')
  })

  it('content slide only shows preparation for enabled modules', () => {
    const bookingOnly = mounts(
      <PanelHost cfg={branched} step="content" stepOrder={allSteps} dispatch={noopDispatch} presets={presets} onPrev={noop} onNext={noop} onLaunch={noop} />,
    )
    expect(bookingOnly).toContain('Starttjänster')
    expect(bookingOnly).toContain('Personal')
    expect(bookingOnly).not.toContain('Bildbibliotek')
    expect(bookingOnly).not.toContain('>Produkter<')

    const shopOnly = mounts(
      <PanelHost
        cfg={{ ...branched, moduleStates: { ...branched.moduleStates, booking: 'off', shop: 'live' } }}
        step="content"
        stepOrder={allSteps}
        dispatch={noopDispatch}
        presets={presets}
        onPrev={noop}
        onNext={noop}
        onLaunch={noop}
      />,
    )
    expect(shopOnly).not.toContain('Starttjänster')
    expect(shopOnly).toContain('>Produkter<')
  })

  it('onboardingen har modulval och startcopy utan att lägga tillbaka tjänste-steget', () => {
    expect(FLAT_STEP_ORDER).toEqual(['start', 'setup', 'content', 'site', 'domain', 'review'])
    expect(FLAT_STEP_ORDER).not.toContain('branch')
    expect(FLAT_STEP_ORDER).not.toContain('bokning')
    expect(FLAT_STEP_ORDER).not.toContain('live')
  })

  it('storefronten visar mallens egen copy utan att operatören skrivit något (branched cfg)', () => {
    const preview = mounts(<PreviewPane cfg={branched} device="desktop" onDevice={noop} />)
    expect(preview).toContain('data-world="storefront"')
    expect(preview.length).toBeGreaterThan(2000) // en hel sida, inte ett tomt skal
  })

  it('en tjänst som ändå finns i cfg renderas i previewen (kunden lägger upp dem i admin)', () => {
    const preview = mounts(<PreviewPane cfg={withServices} device="desktop" onDevice={noop} />)
    expect(preview).toContain('Klippning')
  })

  it('the final panel creates the customer without publishing it', () => {
    const html = mounts(
      <PanelHost
        cfg={branched}
        step="review"
        stepOrder={allSteps}
        dispatch={noopDispatch}
        presets={presets}
        onPrev={noop}
        onNext={noop}
        onLaunch={noop}
      />,
    )
    expect(html).toContain('Skapa kunden')
    expect(html).toContain('Under konfiguration')
  })

  it('marks the final owner-and-create step as required', () => {
    const finalStep = PHASES.flatMap((phase) => phase.steps).find((candidate) => candidate.id === 'review')
    expect(finalStep?.req).toBe(true)
  })

  it('associates the required owner email field with its label', () => {
    const html = mounts(
      <PanelHost
        cfg={branched}
        step="review"
        stepOrder={allSteps}
        dispatch={noopDispatch}
        presets={presets}
        onPrev={noop}
        onNext={noop}
        onLaunch={noop}
      />,
    )
    const ownerLabel = html.match(/<label[^>]*>Ägarens e-post<\/label>/)?.[0]
    const fieldId = ownerLabel?.match(/for="([^"]+)"/)?.[1]
    const emailInput = html.match(/<input[^>]*type="email"[^>]*>/)?.[0]

    expect(fieldId).toBeTruthy()
    expect(emailInput).toContain(`id="${fieldId}"`)
    expect(emailInput).toContain('required=""')
  })

  it('requires an owner email before the customer can be created', () => {
    const html = mounts(
      <PanelHost
        cfg={{
          ...branched,
          name: 'Goal 84 ownerless',
          slug: 'goal84-ownerless',
          ownerName: '',
          ownerEmail: '',
        }}
        step="review"
        stepOrder={allSteps}
        dispatch={noopDispatch}
        presets={presets}
        onPrev={noop}
        onNext={noop}
        onLaunch={noop}
      />,
    )
    expect(html).toContain('Skapa Goal 84 ownerless')
    expect(html).toContain('disabled=""')
    expect(html).toContain('Ägare inbjuds via e-post')
    expect(html).toContain('ägarens e-post')
    expect(html).not.toContain('Ägare kan bjudas in senare')
    expect(html).not.toContain('Ägaren kan bjudas in senare från kundkortet.')
  })

  it('the result-vy (W6) links the real /kunder/[id], shows the reserved address, no theater', () => {
    const html = mounts(
      <ResultView
        name="Klippoteket"
        slug="klippoteket"
        tenant={{ id: 't9', slug: 'klippoteket' }}
        message="Salong skapad. Inbjudan skickad till a@b.se."
        onRestart={noop}
      />,
    )
    expect(html).toContain('href="/kunder/t9"') // real, working platform link
    expect(html).toContain('klippoteket.corevo.se') // canonical reserved address shown
    expect(html).toContain('Onboarda nästa kund')
    expect(html).toContain('är skapad') // honest header, NOT "är live" (host doesn't resolve yet)
    expect(html).not.toContain('byggs i senare vågor') // old placeholder copy is gone
  })

  it('the result-vy falls back to /kunder when the tenant id is missing (W6)', () => {
    const html = mounts(<ResultView name="X" slug="x" message="" onRestart={noop} />)
    expect(html).toContain('href="/kunder"')
  })

  it('OnboardingStudio (root machine) mounts DIRECTLY in the studio stage', () => {
    const html = mounts(<OnboardingStudio presets={presets} />)
    expect(html).toContain('Starta kund') // step-rail phase 1 → wizarden är startskärmen
  })

})
