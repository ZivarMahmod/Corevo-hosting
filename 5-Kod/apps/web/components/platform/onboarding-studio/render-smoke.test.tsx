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
import { SuperEntry } from './SuperEntry'
import { StepRail } from './StepRail'
import { PanelHost } from './PanelHost'
import { PreviewPane } from './PreviewPane'
import { OnboardingStudio } from './OnboardingStudio'

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
  it('JourneyBar mounts (all three journey pills)', () => {
    const reachable: Record<StudioStage, boolean> = { super: true, studio: true, result: false }
    const html = mounts(<JourneyBar stage="studio" reachable={reachable} onNav={noop} />)
    expect(html).toContain('Kunder')
  })

  it('SuperEntry mounts with a real tenant card', () => {
    const html = mounts(<SuperEntry tenants={tenants} onStart={noop} />)
    expect(html).toContain('Kunder')
    expect(html).toContain('Klippoteket')
  })

  it('SuperEntry mounts with the empty-state (0 tenants)', () => {
    const html = mounts(<SuperEntry tenants={[]} onStart={noop} />)
    // honest empty state must still show the entry CTA, never fake numbers
    expect(html).toContain('Onboarda')
    expect(html).not.toContain('24 960')
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

  it('OnboardingStudio (root machine) mounts the super stage', () => {
    const html = mounts(
      <OnboardingStudio presets={presets} tenants={tenants} editorEnabled={false} />,
    )
    expect(html).toContain('Kunder')
  })
})
