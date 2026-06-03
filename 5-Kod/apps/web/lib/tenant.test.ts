import { describe, it, expect } from 'vitest'
import { getTenantFromHost, isExternalHost } from './tenant'

// Explicit opts so these don't depend on NEXT_PUBLIC_* env in the test runner.
const OPTS = { rootDomain: 'corevo.se', platformHost: 'booking.corevo.se' }

describe('getTenantFromHost — host suffix classification', () => {
  it('resolves a real subdomain to its tenant slug', () => {
    expect(getTenantFromHost('freshcut.corevo.se', OPTS)).toEqual({ kind: 'tenant', slug: 'freshcut' })
  })

  it('classifies the platform host', () => {
    expect(getTenantFromHost('booking.corevo.se', OPTS)).toEqual({ kind: 'platform' })
  })

  it('classifies the bare apex as root', () => {
    expect(getTenantFromHost('corevo.se', OPTS)).toEqual({ kind: 'root' })
  })

  it('classifies a reserved subdomain (not a tenant)', () => {
    expect(getTenantFromHost('admin.corevo.se', OPTS)).toEqual({ kind: 'reserved', subdomain: 'admin' })
  })

  it('returns unknown for an external custom domain (→ goal-16 fallback territory)', () => {
    expect(getTenantFromHost('boka.minsalong.se', OPTS)).toEqual({ kind: 'unknown' })
  })

  it('REGRESSION: demo.corevo.se classifies as a .corevo.se subdomain BEFORE any custom-domain lookup', () => {
    // goal-16 recon: the custom-domain RPC branch must never be reached for our own
    // suffix; demo.corevo.se is a subdomain match (kind:tenant), not 'unknown'.
    expect(getTenantFromHost('demo.corevo.se', OPTS)).toEqual({ kind: 'tenant', slug: 'demo' })
  })
})

describe('isExternalHost — custom-domain lookup candidacy', () => {
  it('is TRUE for a real external domain', () => {
    expect(isExternalHost('boka.minsalong.se', OPTS)).toBe(true)
    expect(isExternalHost('kund.se', OPTS)).toBe(true)
  })

  it('is FALSE for our own apex / platform / subdomains', () => {
    expect(isExternalHost('corevo.se', OPTS)).toBe(false)
    expect(isExternalHost('booking.corevo.se', OPTS)).toBe(false)
    expect(isExternalHost('freshcut.corevo.se', OPTS)).toBe(false)
  })

  it('is FALSE for staging/dev noise (workers.dev, localhost, IP)', () => {
    expect(isExternalHost('bokningsplatformen.abc.workers.dev', OPTS)).toBe(false)
    expect(isExternalHost('localhost', OPTS)).toBe(false)
    expect(isExternalHost('localhost:3000', OPTS)).toBe(false)
    expect(isExternalHost('127.0.0.1', OPTS)).toBe(false)
    expect(isExternalHost('freshcut.localhost', OPTS)).toBe(false)
  })

  it('is FALSE for null/undefined/bare-label hosts', () => {
    expect(isExternalHost(null, OPTS)).toBe(false)
    expect(isExternalHost(undefined, OPTS)).toBe(false)
    expect(isExternalHost('justalabel', OPTS)).toBe(false)
  })

  it('strips the port before classifying an external host', () => {
    expect(isExternalHost('minsalong.se:443', OPTS)).toBe(true)
  })
})
