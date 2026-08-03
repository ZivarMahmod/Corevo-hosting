import { describe, expect, it } from 'vitest'
import { buildFixedProbeTargets, buildProbeTargets, isHealthyStatus } from './check_domains.mjs'

describe('buildProbeTargets', () => {
  it('probes committed custom domains before falling back to the booking path', () => {
    expect(buildProbeTargets(['FreshCut', ' demo '], ['freshcut.corevo.se'])).toEqual([
      { host: 'freshcut.corevo.se', path: '/' },
      { host: 'demo.boka.corevo.se', path: '/boka' },
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
