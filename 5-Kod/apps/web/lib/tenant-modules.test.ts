import { describe, expect, it } from 'vitest'
import { isModuleLive, moduleState, MODULE_STATES } from '@/lib/tenant-modules'

describe('binary tenant modules', () => {
  it('has exactly off and live', () => {
    expect([...MODULE_STATES]).toEqual(['off', 'live'])
  })

  it('treats every missing module as off', () => {
    expect(moduleState({}, 'booking')).toBe('off')
    expect(moduleState({}, 'shop')).toBe('off')
  })

  it.each([
    ['off', false],
    ['live', true],
  ] as const)('%s resolves visibility', (state, enabled) => {
    const states = { shop: state }
    expect(isModuleLive(states, 'shop')).toBe(enabled)
  })
})
