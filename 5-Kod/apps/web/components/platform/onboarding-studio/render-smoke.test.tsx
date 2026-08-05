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
    { key: 'lojalitet', name: 'Lojalitet' },
    { key: 'shop', name: 'Webshop' },
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
    expect(html).toContain('Onboarding-studio')
    expect(html).not.toContain('>Kunder<') // gamla entré-pillen ska inte återuppstå
  })

  it('StepRail mounts with the booking provider step', () => {
    const html = mounts(<StepRail cfg={branched} step="branch" onStep={noop} presets={presets} />)
    expect(html).toContain('Grunden')
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
          dispatch={noopDispatch}
          presets={presets}
          onPrev={noop}
          onNext={noop}
          onLaunch={noop}
        />,
      )
    }
  })

  it('keeps module visibility separate from booking presentation', () => {
    const html = mounts(
      <PanelHost
        cfg={branched}
        step="modval"
        dispatch={noopDispatch}
        presets={presets}
        onPrev={noop}
        onNext={noop}
        onLaunch={noop}
      />,
    )
    expect(html).toContain('Bokning')
    expect(html).toContain('På')
    expect(html).not.toContain('Bokningssätt')
  })

  it('the modval panel keeps booking off and hides its variant picker', () => {
    const html = mounts(
      <PanelHost
        cfg={{ ...branched, moduleStates: { ...branched.moduleStates, booking: 'off' } }}
        step="modval"
        dispatch={noopDispatch}
        presets={presets}
        onPrev={noop}
        onNext={noop}
        onLaunch={noop}
      />,
    )
    expect(html).toContain('Av')
    expect(html).not.toContain('Bokningsvariant')
    expect(html).toContain('Av och dold för kunden.')
  })

  it('the booking step shows Corevo and external provider choices', () => {
    const html = mounts(
      <PanelHost cfg={branched} step="bokning" dispatch={noopDispatch} presets={presets} onPrev={noop} onNext={noop} onLaunch={noop} />,
    )
    expect(html).toContain('Corevo-bokning')
    expect(html).toContain('Extern bokning')
    expect(html).toContain('Bokningssätt')
  })

  it('the booking step requires a valid external https URL', () => {
    const html = mounts(
      <PanelHost
        cfg={{ ...branched, bookingProvider: 'external', bookingExternalUrl: 'http://fel.test' }}
        step="bokning"
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

  // 2026-07-11: stegen "Tjänster & priser" och "Utseende & text" är BORTA ur onboardingen
  // (Zivar: "superlätt att komma igång — jag ska inte skriva in tjänster eller rubriker").
  // Texten kommer från branschens mall-text + mallens evergreen-copy; tjänster och
  // accent/logga läggs upp i kundens admin efteråt.
  it('onboardingen har 7 steg och kräver varken tjänster eller rubriker', () => {
    expect(FLAT_STEP_ORDER).toEqual(['branch', 'namn', 'tema', 'modval', 'bokning', 'agare', 'live'])
    expect(FLAT_STEP_ORDER).not.toContain('tjanster')
    expect(FLAT_STEP_ORDER).not.toContain('brand')
  })

  it('mall-steget visar det kategoriserade galleriet (inte en platt namnlista)', () => {
    const html = mounts(
      <PanelHost cfg={branched} step="tema" dispatch={noopDispatch} presets={presets} onPrev={noop} onNext={noop} onLaunch={noop} />,
    )
    expect(html).toContain('Blomsterhandel') // kategori-fliken
    expect(html).toContain('Bokning &amp; behandling')
    expect(html).toContain('Sök mall') // fritextsöket
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
        step="live"
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

  it('marks the owner step as required', () => {
    const ownerStep = PHASES.flatMap((phase) => phase.steps).find((candidate) => candidate.id === 'agare')
    expect(ownerStep?.req).toBe(true)
  })

  it('associates the required owner email field with its label', () => {
    const html = mounts(
      <PanelHost
        cfg={branched}
        step="agare"
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
        step="live"
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
    expect(html).toContain('Grunden') // step-rail phase 1 → wizarden är startskärmen
  })

  // goal-58: tema-steget är INTE längre en platt namnlista ("Temamall") — det renderar
  // ThemeGallery, samma kategoriserade väljare som kundkortets Sida-flik.
  it('tema-steget renderar mall-galleriet med branschens förval markerat', () => {
    const html = mounts(
      <PanelHost cfg={branched} step="tema" dispatch={noopDispatch} presets={presets} onPrev={noop} onNext={noop} onLaunch={noop} />,
    )
    expect(html).toContain('Välj mall')
    expect(html).not.toContain('Temamall') // gamla platta listans rubrik
    expect(html).toContain('Branschens förval') // kalla = frisör-branschens default i presets
  })
})
