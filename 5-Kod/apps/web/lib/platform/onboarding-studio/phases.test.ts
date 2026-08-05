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
  it('shows booking only when the booking module is live', () => {
    expect(visibleStepOrder(applyBranch(initStudioCfg('aurora'), 'frisor', presets), presets)).toContain('bokning')
    expect(visibleStepOrder(applyBranch(initStudioCfg('aurora'), 'studio', presets), presets)).not.toContain('bokning')
  })

  it('keeps the shared setup steps in place', () => {
    expect(visibleStepOrder(applyBranch(initStudioCfg('aurora'), 'studio', presets), presets)).toEqual([
      'branch',
      'namn',
      'modules',
      'appearance',
      'live',
    ])
  })
})
