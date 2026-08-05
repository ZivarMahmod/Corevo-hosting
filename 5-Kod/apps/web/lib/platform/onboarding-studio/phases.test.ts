import { describe, expect, it } from 'vitest'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'
import { applyBranch, initStudioCfg } from './model'
import { visibleStepOrder } from './phases'

const presets: VerticalPresetData = {
  verticals: [
    { key: 'frisor', name: 'Frisör', defaultTemplate: 'aurora', defaultModules: { booking: 'live' }, terminology: {} },
    { key: 'studio', name: 'Studio', defaultTemplate: 'aurora', defaultModules: { booking: 'off' }, terminology: {} },
  ],
  modules: [
    { key: 'booking', name: 'Bokning' },
    { key: 'galleri', name: 'Galleri' },
  ],
  templatesByVertical: {},
}

describe('visibleStepOrder', () => {
  it('keeps the same six-slide journey for Corevo and external customers', () => {
    expect(visibleStepOrder(applyBranch(initStudioCfg('aurora'), 'frisor', presets), presets)).toEqual([
      'start',
      'setup',
      'content',
      'site',
      'domain',
      'review',
    ])
    expect(visibleStepOrder(applyBranch(initStudioCfg('aurora'), 'studio', presets), presets)).toEqual([
      'start',
      'setup',
      'content',
      'site',
      'domain',
      'review',
    ])
  })

  it('keeps the shared setup order in place', () => {
    expect(visibleStepOrder(applyBranch(initStudioCfg('aurora'), 'studio', presets), presets)).toEqual([
      'start',
      'setup',
      'content',
      'site',
      'domain',
      'review',
    ])
  })
})
