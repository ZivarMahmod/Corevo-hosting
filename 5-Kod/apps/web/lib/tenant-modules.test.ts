import { describe, it, expect } from 'vitest'
import {
  moduleState,
  isModuleLive,
  isModulePaused,
  MODULE_STATES,
  type TenantModuleStates,
} from '@/lib/tenant-modules'

// Multi-bransch spår 5 — storefront module gating. The load-bearing guarantee is
// BACKWARD COMPATIBILITY: a tenant with NO tenant_modules row for `booking` must
// resolve to 'live' so FreshCut (and any un-migrated salon) renders unchanged.

describe('moduleState — per-module default fallback', () => {
  it('booking with no row → live (the FreshCut-unchanged guarantee)', () => {
    expect(moduleState({}, 'booking')).toBe('live')
  })

  it('a non-booking module with no row → off (opt-in)', () => {
    expect(moduleState({}, 'media_library')).toBe('off')
    expect(moduleState({}, 'loyalty')).toBe('off')
  })

  it('an explicit row wins over the default for booking', () => {
    const states: TenantModuleStates = { booking: 'paused' }
    expect(moduleState(states, 'booking')).toBe('paused')
  })

  it('an explicit row is returned verbatim for any module', () => {
    const states: TenantModuleStates = { media_library: 'live', booking: 'draft' }
    expect(moduleState(states, 'media_library')).toBe('live')
    expect(moduleState(states, 'booking')).toBe('draft')
  })
})

describe('isModuleLive / isModulePaused', () => {
  it('missing booking row counts as live', () => {
    expect(isModuleLive({}, 'booking')).toBe(true)
    expect(isModulePaused({}, 'booking')).toBe(false)
  })

  it('only the exact state matches', () => {
    expect(isModuleLive({ booking: 'live' }, 'booking')).toBe(true)
    expect(isModuleLive({ booking: 'draft' }, 'booking')).toBe(false)
    expect(isModulePaused({ booking: 'paused' }, 'booking')).toBe(true)
    expect(isModulePaused({ booking: 'live' }, 'booking')).toBe(false)
  })

  it('draft/off booking is NOT live (not public) and NOT paused (no banner)', () => {
    for (const st of ['draft', 'off'] as const) {
      expect(isModuleLive({ booking: st }, 'booking')).toBe(false)
      expect(isModulePaused({ booking: st }, 'booking')).toBe(false)
    }
  })
})

describe('MODULE_STATES', () => {
  it('is exactly the four lifecycle states from the schema check constraint', () => {
    expect([...MODULE_STATES]).toEqual(['off', 'draft', 'live', 'paused'])
  })
})
