import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  workerDomainsConfigured,
  subdomainFor,
  attachWorkerSubdomain,
  listWorkerDomains,
  type FetchLike,
} from './worker-domains'

const ENV_KEYS = ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'CF_ZONE_ID', 'DOMAIN_AUTOATTACH_ENABLED', 'CF_WORKER_NAME']
const saved: Record<string, string | undefined> = {}

function enable() {
  process.env.CF_API_TOKEN = 'tok'
  process.env.CF_ACCOUNT_ID = 'acct'
  process.env.CF_ZONE_ID = 'zone'
  process.env.DOMAIN_AUTOATTACH_ENABLED = 'true'
  process.env.CF_WORKER_NAME = 'bokningsplatformen'
}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  for (const k of ENV_KEYS) delete process.env[k]
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('subdomainFor', () => {
  it('builds <slug>.corevo.se, lowercased + trimmed', () => {
    expect(subdomainFor('  Test-Barber ')).toBe('test-barber.corevo.se')
  })
})

describe('workerDomainsConfigured', () => {
  it('false when not configured', () => {
    expect(workerDomainsConfigured()).toBe(false)
  })
  it('true with all creds + flag on', () => {
    enable()
    expect(workerDomainsConfigured()).toBe(true)
  })
  it('false when flag off even with creds', () => {
    enable()
    process.env.DOMAIN_AUTOATTACH_ENABLED = 'false'
    expect(workerDomainsConfigured()).toBe(false)
  })
})

describe('attachWorkerSubdomain', () => {
  it('FAIL-CLOSED (ok:false, no throw) when not configured', async () => {
    const r = await attachWorkerSubdomain('salongx')
    expect(r.ok).toBe(false)
  })

  it('PUTs the worker-domains endpoint with the right body when configured', async () => {
    enable()
    let captured: { url: string; init: { method?: string; body?: string } } | null = null
    const fake: FetchLike = async (url, init) => {
      captured = { url, init: init ?? {} }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: { id: 'd1', hostname: 'salongx.corevo.se', service: 'bokningsplatformen', environment: 'production' },
        }),
      }
    }
    const r = await attachWorkerSubdomain('salongx', fake)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.hostname).toBe('salongx.corevo.se')
    expect(captured).not.toBeNull()
    const cap = captured as unknown as { url: string; init: { method?: string; body?: string } }
    expect(cap.url).toContain('/accounts/acct/workers/domains')
    expect(cap.init.method).toBe('PUT')
    const body = JSON.parse(cap.init.body ?? '{}')
    expect(body).toMatchObject({ zone_id: 'zone', hostname: 'salongx.corevo.se', service: 'bokningsplatformen' })
  })

  it('returns ok:false on a CF error envelope', async () => {
    enable()
    const fake: FetchLike = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ success: false, errors: [{ message: 'insufficient permissions' }] }),
    })
    const r = await attachWorkerSubdomain('salongx', fake)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/insufficient permissions/)
  })
})

describe('listWorkerDomains', () => {
  it('FAIL-CLOSED when not configured', async () => {
    const r = await listWorkerDomains()
    expect(r.ok).toBe(false)
  })

  it('returns only our service domains', async () => {
    enable()
    const fake: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: [
          { id: 'a', hostname: 'booking.corevo.se', service: 'bokningsplatformen', environment: 'production' },
          { id: 'b', hostname: 'other.corevo.se', service: 'some-other-worker', environment: 'production' },
        ],
      }),
    })
    const r = await listWorkerDomains(fake)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).toHaveLength(1)
      expect(r.data[0]?.hostname).toBe('booking.corevo.se')
    }
  })
})
