import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import { POST } from './route'

const originalKey = process.env.CUSTOMER_PORTAL_HMAC_KEY
const linkPublicId = '123e4567-e89b-42d3-a456-426614174000'
const secret = 'A'.repeat(43)

function request(
  body: unknown,
  options: { origin?: string; url?: string; contentType?: string; rawBody?: string } = {},
): Request {
  return new Request(options.url ?? 'https://mina.corevo.se/api/customer-portal/exchange', {
    method: 'POST',
    headers: {
      origin: options.origin ?? 'https://mina.corevo.se',
      'content-type': options.contentType ?? 'application/json',
    },
    body: options.rawBody ?? JSON.stringify(body),
  })
}

const body = { tenantSlug: 'freshcut', linkPublicId, secret, keyVersion: 1 }

afterAll(() => {
  if (originalKey === undefined) delete process.env.CUSTOMER_PORTAL_HMAC_KEY
  else process.env.CUSTOMER_PORTAL_HMAC_KEY = originalKey
})

describe('POST /api/customer-portal/exchange', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
    mocks.createServiceClient.mockReturnValue({ rpc })
    rpc.mockImplementation(async (_name: string, args: Record<string, string | number>) => ({
      data: [{
        outcome: 'ok',
        session_public_id: args.p_new_session_public_id,
        tenant_slug: 'freshcut',
      }],
      error: null,
    }))
  })

  it('exchanges digests through 0120 and sets the exact host-only session cookie', async () => {
    const response = await POST(request(body))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')

    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('customer_portal_exchange_link', {
      p_link_public_id: linkPublicId,
      p_token_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_new_session_public_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      p_new_session_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_key_version: 1,
    })
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(secret)

    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('__Host-corevo-portal=v1.')
    expect(cookie).toContain('Max-Age=15552000')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=lax')
    expect(cookie.toLowerCase()).not.toContain('domain=')
  })

  it('fails neutrally when DB tenant does not match the route tenant', async () => {
    rpc.mockImplementationOnce(async (_name: string, args: Record<string, string | number>) => ({
      data: [{ outcome: 'ok', session_public_id: args.p_new_session_public_id, tenant_slug: 'other' }],
      error: null,
    }))
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ ok: false })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects cross-origin, query credentials and malformed input before DB', async () => {
    expect((await POST(request(body, { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await POST(request(body, {
      url: `https://mina.corevo.se/api/customer-portal/exchange?token=${secret}`,
    }))).status).toBe(400)
    expect((await POST(request({ ...body, secret: 'short' }))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects non-JSON and oversized bodies before DB', async () => {
    const wrongType = await POST(request(body, { contentType: 'text/plain' }))
    expect(wrongType.status).toBe(415)
    await expect(wrongType.json()).resolves.toEqual({ ok: false })

    const oversized = await POST(request(body, { rawBody: 'x'.repeat(4097) }))
    expect(oversized.status).toBe(413)
    await expect(oversized.json()).resolves.toEqual({ ok: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns neutral no-store errors for invalid links or unavailable server config', async () => {
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'invalid' }], error: null })
    const invalid = await POST(request(body))
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({ ok: false })
    expect(invalid.headers.get('cache-control')).toBe('no-store')

    delete process.env.CUSTOMER_PORTAL_HMAC_KEY
    const unavailable = await POST(request(body))
    expect(unavailable.status).toBe(503)
    await expect(unavailable.json()).resolves.toEqual({ ok: false })
  })
})
