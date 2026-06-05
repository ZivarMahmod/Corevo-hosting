import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  hasCloudflareCredentials,
  createCustomHostname,
  getCustomHostnameByName,
  deleteCustomHostname,
  type FetchLike,
} from './custom-hostnames'

// goal-23: the CF for SaaS client is the gated WRITE path. Env is read lazily, so we
// stub process.env per case. fetch is injected, so no network. Two invariants matter
// most: FAIL-CLOSED without creds (never throw, never fetch), and DCV extraction.

const ENV_KEYS = ['CF_API_TOKEN', 'CF_ZONE_ID', 'CF_FALLBACK_ORIGIN'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k]
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function withCreds() {
  process.env.CF_API_TOKEN = 'test-token'
  process.env.CF_ZONE_ID = 'zone-123'
}

/** A FetchLike that records calls and returns a canned CF envelope. */
function mockFetch(envelope: unknown, ok = true, status = 200) {
  const calls: { url: string; init?: unknown }[] = []
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init })
    return { ok, status, json: async () => envelope }
  }
  return { fn, calls }
}

describe('hasCloudflareCredentials', () => {
  it('false when secrets are unset (fail-closed default)', () => {
    delete process.env.CF_API_TOKEN
    delete process.env.CF_ZONE_ID
    expect(hasCloudflareCredentials()).toBe(false)
  })
  it('true only when BOTH token and zone are set', () => {
    process.env.CF_API_TOKEN = 't'
    delete process.env.CF_ZONE_ID
    expect(hasCloudflareCredentials()).toBe(false)
    process.env.CF_ZONE_ID = 'z'
    expect(hasCloudflareCredentials()).toBe(true)
  })
})

describe('createCustomHostname', () => {
  it('FAIL-CLOSED without creds: returns error, never calls fetch', async () => {
    delete process.env.CF_API_TOKEN
    delete process.env.CF_ZONE_ID
    const { fn, calls } = mockFetch({})
    const res = await createCustomHostname('boka.salong.se', fn)
    expect(res.ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('extracts DCV (ownership TXT + SSL TXT + routing CNAME) on success', async () => {
    withCreds()
    process.env.CF_FALLBACK_ORIGIN = 'ssl.corevo.se'
    const { fn, calls } = mockFetch({
      success: true,
      result: {
        id: 'ch-1',
        hostname: 'boka.salong.se',
        status: 'pending',
        ssl: {
          status: 'pending_validation',
          method: 'txt',
          validation_records: [{ txt_name: '_acme.boka.salong.se', txt_value: 'abc123' }],
        },
        ownership_verification: { type: 'txt', name: '_cf.boka.salong.se', value: 'own-xyz' },
      },
    })
    const res = await createCustomHostname('boka.salong.se', fn)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.id).toBe('ch-1')
    expect(res.data.status).toBe('pending')
    expect(res.data.sslStatus).toBe('pending_validation')
    // POST to the right endpoint
    expect(calls[0]!.url).toContain('/zones/zone-123/custom_hostnames')
    // DCV: routing CNAME + ownership TXT + SSL TXT
    const purposes = res.data.dcv.map((r) => r.purpose)
    expect(purposes).toContain('Routing')
    expect(purposes).toContain('Ägarskap')
    expect(purposes).toContain('SSL (DCV)')
    const routing = res.data.dcv.find((r) => r.purpose === 'Routing')
    expect(routing).toMatchObject({ type: 'CNAME', name: 'boka.salong.se', value: 'ssl.corevo.se' })
  })

  it('surfaces a CF error envelope as { ok:false }', async () => {
    withCreds()
    const { fn } = mockFetch({ success: false, errors: [{ message: 'hostname already exists' }] }, false, 409)
    const res = await createCustomHostname('boka.salong.se', fn)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('hostname already exists')
  })

  it('does not throw when fetch rejects (network)', async () => {
    withCreds()
    const fn: FetchLike = async () => {
      throw new Error('network down')
    }
    const res = await createCustomHostname('boka.salong.se', fn)
    expect(res.ok).toBe(false)
  })
})

describe('getCustomHostnameByName', () => {
  it('returns the matching hostname from the list', async () => {
    withCreds()
    const { fn, calls } = mockFetch({
      success: true,
      result: [{ id: 'ch-9', hostname: 'boka.salong.se', status: 'active', ssl: { status: 'active' } }],
    })
    const res = await getCustomHostnameByName('boka.salong.se', fn)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data?.id).toBe('ch-9')
    expect(res.data?.status).toBe('active')
    expect(calls[0]!.url).toContain('hostname=boka.salong.se')
  })

  it('returns null-data when CF knows no such hostname', async () => {
    withCreds()
    const { fn } = mockFetch({ success: true, result: [] })
    const res = await getCustomHostnameByName('nope.salong.se', fn)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data).toBeNull()
  })

  it('returns null (NOT a sibling) when the list has only a non-matching hostname', async () => {
    // guards the dropped `?? list[0]` fallback: a foreign hostname must never be returned
    // for a domain that does not exactly match (verify/remove key on this).
    withCreds()
    const { fn } = mockFetch({
      success: true,
      result: [{ id: 'ch-other', hostname: 'someone-else.se', status: 'active', ssl: { status: 'active' } }],
    })
    const res = await getCustomHostnameByName('boka.salong.se', fn)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data).toBeNull()
  })
})

describe('deleteCustomHostname', () => {
  it('FAIL-CLOSED without creds', async () => {
    delete process.env.CF_API_TOKEN
    const { fn, calls } = mockFetch({ success: true })
    const res = await deleteCustomHostname('ch-1', fn)
    expect(res.ok).toBe(false)
    expect(calls).toHaveLength(0)
  })
  it('errors on a missing id without calling CF', async () => {
    withCreds()
    const { fn, calls } = mockFetch({ success: true })
    const res = await deleteCustomHostname('', fn)
    expect(res.ok).toBe(false)
    expect(calls).toHaveLength(0)
  })
  it('returns ok on a successful delete (DELETE to the id endpoint)', async () => {
    withCreds()
    const { fn, calls } = mockFetch({ success: true, result: { id: 'ch-1' } })
    const res = await deleteCustomHostname('ch-1', fn)
    expect(res.ok).toBe(true)
    expect(calls[0]!.url).toContain('/custom_hostnames/ch-1')
    expect(calls[0]!.init).toMatchObject({ method: 'DELETE' })
  })
})
