// goal-36 — the look preview must SHOW a selected module woven into the chosen look.
// These guard the wiring: activeModuleKeys (what flows to the look iframe) + that the
// reused ModuleSections actually renders a selected module's section. (The look route
// rebuilds a cfg from the ?modules= query and renders these same sections.)
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { initStudioCfg } from '@/lib/platform/onboarding-studio/model'
import type { ModuleState } from '@/lib/tenant-modules'
import { activeModuleKeys, ModuleSections } from './preview-modules'

function cfgWith(moduleStates: Record<string, ModuleState>, branch: string | null = 'frisor') {
  return { ...initStudioCfg('Demosalong'), branch, moduleStates }
}

describe('activeModuleKeys (what flows into the look preview)', () => {
  it('includes a live module, excludes booking (woven into the look itself)', () => {
    const keys = activeModuleKeys(cfgWith({ shop: 'live', booking: 'live', offert: 'off' }))
    expect(keys).toContain('shop')
    expect(keys).not.toContain('booking') // booking weaves into the look HTML, not as a section
    expect(keys).not.toContain('offert')
  })
  it('includes paused modules (shown read-only) but never off ones', () => {
    const keys = activeModuleKeys(cfgWith({ shop: 'paused', presentkort: 'off' }))
    expect(keys).toContain('shop')
    expect(keys).not.toContain('presentkort')
  })
  it('empty when nothing picked (fresh cfg, no bransch)', () => {
    expect(activeModuleKeys(cfgWith({}, null))).toEqual([])
  })
})

describe('ModuleSections renders a selected module (the route reuses this)', () => {
  it('shows the Webshop section when shop is live', () => {
    const html = renderToStaticMarkup(createElement(ModuleSections, { cfg: cfgWith({ shop: 'live' }) }))
    expect(html).toContain('Webshop')
  })
  it('shows offert when offert is live, and not when off', () => {
    expect(renderToStaticMarkup(createElement(ModuleSections, { cfg: cfgWith({ offert: 'live' }) }))).toContain('Begär offert')
    expect(renderToStaticMarkup(createElement(ModuleSections, { cfg: cfgWith({ offert: 'off' }) }))).not.toContain('Begär offert')
  })
  it('renders nothing when no section module is active', () => {
    // booking-only (booking floors to live) → no separate section → null render
    const html = renderToStaticMarkup(createElement(ModuleSections, { cfg: cfgWith({ booking: 'live' }) }))
    expect(html).toBe('')
  })
})
