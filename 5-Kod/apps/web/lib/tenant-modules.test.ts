import { describe, expect, it } from 'vitest'
import {
  canTransitionModuleState,
  isModuleAdminWritable,
  isModuleLive,
  isModulePublicReadable,
  moduleState,
  MODULE_STATES,
} from '@/lib/tenant-modules'

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
  ] as const)('%s means the same thing publicly and in admin', (state, enabled) => {
    const states = { shop: state }
    expect(isModuleLive(states, 'shop')).toBe(enabled)
    expect(isModulePublicReadable(states, 'shop')).toBe(enabled)
    expect(isModuleAdminWritable(states, 'shop')).toBe(enabled)
  })

  it('reserves every on/off change for platform operators', () => {
    expect(canTransitionModuleState('off', 'live', false)).toBe(false)
    expect(canTransitionModuleState('live', 'off', false)).toBe(false)
    expect(canTransitionModuleState('off', 'live', true)).toBe(true)
    expect(canTransitionModuleState('live', 'off', true)).toBe(true)
    expect(canTransitionModuleState('live', 'live', false)).toBe(true)
  })
})
