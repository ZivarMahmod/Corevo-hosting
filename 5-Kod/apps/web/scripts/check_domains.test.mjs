import { describe, expect, it } from 'vitest'
import { buildFixedProbeTargets, buildProbeTargets, isHealthyStatus } from './check_domains.mjs'

describe('buildProbeTargets', () => {
  it('probes every exact tenant host attached to this worker, never a wildcard or fixed door', () => {
    expect(buildProbeTargets(['FreshCut.corevo.se', ' demo.corevo.se ', 'booking.corevo.se'])).toEqual([
      { host: 'demo.corevo.se', path: '/boka' },
      { host: 'freshcut.corevo.se', path: '/boka' },
    ])
  })
})

describe('buildFixedProbeTargets', () => {
  it('probes the customer portal on its real route', () => {
    expect(buildFixedProbeTargets(['booking.corevo.se', 'mina.corevo.se'])).toEqual([
      { host: 'booking.corevo.se', path: '/' },
      { host: 'mina.corevo.se', path: '/mina' },
    ])
  })
})

describe('isHealthyStatus', () => {
  it('accepts only successful responses and redirects', () => {
    expect(isHealthyStatus(200)).toBe(true)
    expect(isHealthyStatus(308)).toBe(true)
    expect(isHealthyStatus(404)).toBe(false)
    expect(isHealthyStatus(500)).toBe(false)
  })
})
