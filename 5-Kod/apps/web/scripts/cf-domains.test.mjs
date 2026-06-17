import { describe, it, expect } from 'vitest'
import {
  cfApi,
  resolveZoneId,
  resolveAccountId,
  listWorkerDomains,
  attachWorkerDomain,
} from './cf-domains.mjs'

const fakeFetch = (status, json) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => json,
})

describe('cfApi', () => {
  it('throws when the token is missing', () => {
    expect(() => cfApi('')).toThrow(/CLOUDFLARE_API_TOKEN/)
  })

  it('returns result on success:true', async () => {
    const req = cfApi('tok', fakeFetch(200, { success: true, result: [{ id: 'z1' }], errors: [] }))
    expect(await req('GET', '/zones')).toEqual([{ id: 'z1' }])
  })

  it('throws CF error detail on success:false', async () => {
    const req = cfApi('tok', fakeFetch(200, { success: false, result: null, errors: [{ code: 10000, message: 'auth' }] }))
    await expect(req('GET', '/zones')).rejects.toThrow(/10000 auth/)
  })

  it('throws on a non-2xx transport error', async () => {
    const req = cfApi('tok', fakeFetch(500, { success: false, errors: [] }))
    await expect(req('GET', '/zones')).rejects.toThrow(/HTTP 500/)
  })

  it('sends the bearer token + JSON body', async () => {
    let seen
    const req = cfApi('mytok', async (url, init) => {
      seen = { url, init }
      return { ok: true, status: 200, json: async () => ({ success: true, result: {} }) }
    })
    await req('PUT', '/x', { a: 1 })
    expect(seen.url).toContain('https://api.cloudflare.com/client/v4/x')
    expect(seen.init.headers.authorization).toBe('Bearer mytok')
    expect(seen.init.body).toBe('{"a":1}')
  })
})

describe('resolveZoneId / resolveAccountId', () => {
  it('resolveZoneId returns the zone id', async () => {
    const req = cfApi('t', fakeFetch(200, { success: true, result: [{ id: 'zone123' }] }))
    expect(await resolveZoneId(req, 'corevo.se')).toBe('zone123')
  })
  it('resolveZoneId throws when the zone is absent', async () => {
    const req = cfApi('t', fakeFetch(200, { success: true, result: [] }))
    await expect(resolveZoneId(req, 'corevo.se')).rejects.toThrow(/zone 'corevo.se' not found/)
  })
  it('resolveAccountId prefers the explicit env value WITHOUT a network call', async () => {
    let called = false
    const req = async () => {
      called = true
      return []
    }
    expect(await resolveAccountId(req, 'acct-env')).toBe('acct-env')
    expect(called).toBe(false)
  })
  it('resolveAccountId falls back to GET /accounts when unset', async () => {
    const req = cfApi('t', fakeFetch(200, { success: true, result: [{ id: 'acctX' }] }))
    expect(await resolveAccountId(req, undefined)).toBe('acctX')
  })
})

describe('listWorkerDomains', () => {
  // Account-wide, cross-zone GET: another worker's domains + a non-prod env entry.
  const ALL = {
    success: true,
    result: [
      { hostname: 'sadaqahsweden.se', service: 'sadaqahsweden', environment: 'production' },
      { hostname: 'booking.corevo.se', service: 'bokningsplatformen', environment: 'production' },
      { hostname: 'test-barber.corevo.se', service: 'bokningsplatformen', environment: 'production' },
      { hostname: 'staging-thing.corevo.se', service: 'bokningsplatformen', environment: 'staging' },
    ],
  }

  it('returns ONLY production hostnames of OUR worker (cross-zone safe)', async () => {
    const req = cfApi('t', fakeFetch(200, ALL))
    const hosts = await listWorkerDomains(req, 'acct', 'bokningsplatformen')
    expect(hosts).toEqual(['booking.corevo.se', 'test-barber.corevo.se'])
    expect(hosts).not.toContain('sadaqahsweden.se') // other worker
    expect(hosts).not.toContain('staging-thing.corevo.se') // non-prod env
  })
})

describe('attachWorkerDomain', () => {
  it('PUTs the correct worker-domain body', async () => {
    const calls = []
    const req = async (method, path, body) => {
      calls.push({ method, path, body })
      return { id: 'ok' }
    }
    await attachWorkerDomain(req, {
      accountId: 'acct',
      hostname: 'test-barber.corevo.se',
      service: 'bokningsplatformen',
      zoneId: 'z1',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].path).toBe('/accounts/acct/workers/domains')
    expect(calls[0].body).toEqual({
      environment: 'production',
      hostname: 'test-barber.corevo.se',
      service: 'bokningsplatformen',
      zone_id: 'z1',
    })
  })
})
