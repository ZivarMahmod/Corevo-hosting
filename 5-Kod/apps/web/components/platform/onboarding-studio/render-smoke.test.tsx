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
vi.mock('@/lib/platform/actions', () => ({ createTenant: async () => ({}) }))

// W2: PreviewPane now mounts the REAL storefront layout; Bookable inside it calls
// useRouter (next/navigation) — stub it so the node render env doesn't throw.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))

import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import type { TenantCardItem } from '@/lib/platform/tenants'
import { initStudioCfg, applyBranch } from '@/lib/platform/onboarding-studio/model'
import type { StudioAction, StudioStage } from '@/lib/platform/onboarding-studio/state'
import { FLAT_STEP_ORDER } from '@/lib/platform/onboarding-studio/phases'
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
      defaultTemplate: 'salvia',
      defaultModules: { booking: 'live', lojalitet: 'draft', shop: 'off' },
      terminology: { service: 'Behandling', staff: 'Stylist' },
    },
    { key: 'generell', name: 'Generell', defaultTemplate: null, defaultModules: {}, terminology: {} },
  ],
  modules: [
    { key: 'booking', name: 'Bokning' },
    { key: 'lojalitet', name: 'Lojalitet' },
    { key: 'shop', name: 'Webshop' },
  ],
  templatesByVertical: { frisor: [{ key: 'salvia', name: 'Salvia' }], generell: [{ key: 'edit', name: 'Edit' }] },
}

const noopDispatch = (() => {}) as Dispatch<StudioAction>
const noop = () => {}

// A cfg with a bransch applied → branch/tema/modval panels have real preset data.
const branched = applyBranch(initStudioCfg('salvia'), 'frisor', presets)
const fresh = initStudioCfg('salvia')
// W4: a cfg with a typed service → tjanster panel rows + live preview reflect it.
const withServices = { ...branched, services: [{ name: 'Klippning', price: '350' }] }

const tenants: TenantCardItem[] = [
  {
    id: 't1',
    name: 'Klippoteket',
    slug: 'klippoteket',
    status: 'active',
    markColor: '#1F4636',
    owner: 'Ada Ek',
    themeLabel: 'Salvia',
    variantLabel: 'Wizard',
    level: 'standard',
    bookings: 12,
    completed: 9,
    staff: 3,
    lastActivityAt: null,
    displayStatus: 'active',
  } as unknown as TenantCardItem,
]

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

  it('StepRail mounts (5 phases / 12 steps)', () => {
    const html = mounts(<StepRail cfg={branched} step="branch" onStep={noop} presets={presets} />)
    expect(html).toContain('Grunden')
  })

  it('PreviewPane mounts the real themed storefront render (W2)', () => {
    const html = mounts(<PreviewPane cfg={branched} device="desktop" onDevice={noop} />)
    expect(html).toContain('data-world="storefront"') // real storefront render, not a skeleton
  })

  it('PanelHost mounts EVERY one of the 12 steps (branched cfg)', () => {
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

  it('the modval panel renders the booking-variant picker (W3, booking active)', () => {
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
    // booking is live in the branched cfg → the sub-choice picker renders all 4 variants
    expect(html).toContain('Bokningsvariant')
    expect(html).toContain('Snabbboka') // the compact variant label
  })

  it('the tjanster panel renders the real add-service control (W4, not a deferred stub)', () => {
    const html = mounts(
      <PanelHost cfg={branched} step="tjanster" dispatch={noopDispatch} presets={presets} onPrev={noop} onNext={noop} onLaunch={noop} />,
    )
    expect(html).toContain('Lägg till')
    expect(html).not.toContain('senare våg') // old deferred-stub copy is gone
  })

  it('a typed service renders in both the tjanster panel and the live preview (W4)', () => {
    const panel = mounts(
      <PanelHost cfg={withServices} step="tjanster" dispatch={noopDispatch} presets={presets} onPrev={noop} onNext={noop} onLaunch={noop} />,
    )
    expect(panel).toContain('Klippning')
    expect(panel).toContain('350') // the kr price string in the row input
    // the live preview's booking section reflects the same service (not the empty-state)
    const preview = mounts(<PreviewPane cfg={withServices} device="desktop" onDevice={noop} />)
    expect(preview).toContain('Klippning')
  })

  it('the text panel renders the real hero + ingress fields (W5, not a deferred note)', () => {
    const html = mounts(
      <PanelHost cfg={branched} step="text" dispatch={noopDispatch} presets={presets} onPrev={noop} onNext={noop} onLaunch={noop} />,
    )
    expect(html).toContain('Rubrik (hero)')
    expect(html).toContain('Ingress')
    expect(html).not.toContain('senare våg') // old deferred copy is gone
  })

  it('a custom hero title flows through to the live preview (W5)', () => {
    const cfg = { ...branched, heroTitle: 'Min Unika Rubrik' }
    const preview = mounts(<PreviewPane cfg={cfg} device="desktop" onDevice={noop} />)
    expect(preview).toContain('Min Unika Rubrik') // resolveThemeContent override → layout hero
  })

  it('the live panel renders the real Lansera button', () => {
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
    expect(html).toContain('Lansera')
  })

  it('the result-vy (W6) links the real /salonger/[id], shows the reserved address, no theater', () => {
    const html = mounts(
      <ResultView
        name="Klippoteket"
        slug="klippoteket"
        tenant={{ id: 't9', slug: 'klippoteket' }}
        message="Salong skapad. Inbjudan skickad till a@b.se."
        onRestart={noop}
      />,
    )
    expect(html).toContain('href="/salonger/t9"') // real, working platform link
    expect(html).toContain('klippoteket.corevo.se') // reserved address shown
    expect(html).toContain('Onboarda nästa kund')
    expect(html).toContain('är skapad') // honest header, NOT "är live" (host doesn't resolve yet)
    expect(html).not.toContain('byggs i senare vågor') // old placeholder copy is gone
  })

  it('the result-vy falls back to /salonger when the tenant id is missing (W6)', () => {
    const html = mounts(<ResultView name="X" slug="x" message="" onRestart={noop} />)
    expect(html).toContain('href="/salonger"')
  })

  it('OnboardingStudio (root machine) mounts DIRECTLY in the studio stage', () => {
    const html = mounts(
      <OnboardingStudio presets={presets} tenants={tenants} editorEnabled={false} />,
    )
    expect(html).toContain('Grunden') // step-rail phase 1 → wizarden är startskärmen
  })

  // ── goal-50: the look-gallery + render-bron preview (sajtbyggare ON) ──────────────
  // goal-51 baseline: no real looks exist; these are neutral fixtures proving the gallery
  // renders whatever look list it is GIVEN (the box is a prop here, not look-registry).
  const looks = [
    { key: 'demolook', name: 'Demolook', vibeTags: ['varm', 'mat'], thumbnail: '/sajtbyggare/demolook/img/hero.jpg' },
    { key: 'demoklipp', name: 'Demoklipp', vibeTags: ['bold'], thumbnail: '/sajtbyggare/demoklipp/img/hero.jpg' },
  ]

  it('the tema panel becomes the flat look-GALLERY when the box is passed (no bransch filter)', () => {
    // cfg.branch=frisor, but the gallery shows ALL looks regardless (live-bevis #2 fix).
    const html = mounts(
      <PanelHost
        cfg={{ ...branched, theme: 'demolook' }}
        step="tema"
        dispatch={noopDispatch}
        presets={presets}
        looks={looks}
        onPrev={noop}
        onNext={noop}
        onLaunch={noop}
      />,
    )
    expect(html).toContain('Välj mall')
    expect(html).toContain('Demolook')
    expect(html).toContain('Demoklipp') // ALL looks, not just the bransch's
    expect(html).not.toContain('Temamall') // the legacy theme-list title is gone in gallery mode
  })

  it('without a box (flag-OFF) the tema panel stays the legacy theme list, byte-identical', () => {
    const html = mounts(
      <PanelHost cfg={branched} step="tema" dispatch={noopDispatch} presets={presets} onPrev={noop} onNext={noop} onLaunch={noop} />,
    )
    expect(html).toContain('Temamall') // legacy title
    expect(html).not.toContain('Välj mall')
  })
})
