import { describe, expect, it } from 'vitest'
import { buildProbeTargets, isHealthyStatus } from './check_domains.mjs'

describe('buildProbeTargets', () => {
  it('probes each active tenant on the canonical booking path', () => {
    expect(buildProbeTargets(['FreshCut', ' demo '])).toEqual([
      { host: 'freshcut.boka.corevo.se', path: '/boka' },
      { host: 'demo.boka.corevo.se', path: '/boka' },
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
