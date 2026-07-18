import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}))

vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/observability', () => ({
  logger: { warn: mocks.warn, info: mocks.info },
}))

import { POST } from './route'

const originalSecret = process.env.SMS_46ELKS_CALLBACK_SECRET
const PROVIDER_ID = 's70df59406a1b4643b96f3f91e0bfb7b0'

function request(
  body: Record<string, string>,
  options: {
    ip?: string
    auth?: string | null
    contentType?: string
    queryKey?: string
  } = {},
): Request {
  const url = new URL('https://booking.corevo.se/api/webhooks/46elks/delivery')
  if (options.queryKey) url.searchParams.set('key', options.queryKey)
  const headers = new Headers({
    'content-type': options.contentType ?? 'application/x-www-form-urlencoded',
    'cf-connecting-ip': options.ip ?? '176.10.154.199',
  })
  const auth = options.auth === undefined
    ? `Basic ${btoa('corevo:callback-secret')}`
    : options.auth
  if (auth) headers.set('authorization', auth)
  return new Request(url, { method: 'POST', headers, body: new URLSearchParams(body) })
}

afterAll(() => {
  if (originalSecret === undefined) delete process.env.SMS_46ELKS_CALLBACK_SECRET
  else process.env.SMS_46ELKS_CALLBACK_SECRET = originalSecret
})

describe('46elks delivery webhook', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SMS_46ELKS_CALLBACK_SECRET = 'callback-secret'
    mocks.createServiceClient.mockReturnValue({ rpc })
    rpc.mockResolvedValue({ data: 'updated', error: null })
  })

  it.each([
    '176.10.154.199',
    '85.24.146.132',
    '185.39.146.243',
    '2001:9b0:2:902::199',
  ])('tillåter dokumenterad callback-källa %s', async (ip) => {
    const response = await POST(request({ id: PROVIDER_ID, status: 'sent' }, { ip }))
    expect(response.status).toBe(204)
  })

  it('nekar okänd källa före payload och DB', async () => {
    const response = await POST(
      request({ id: PROVIDER_ID, status: 'sent' }, { ip: '203.0.113.10' }),
    )
    expect(response.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('nekar fel/saknad Basic Auth, även när query-key försöker ersätta den', async () => {
    expect((await POST(request(
      { id: PROVIDER_ID, status: 'sent' },
      { auth: `Basic ${btoa('corevo:wrong')}` },
    ))).status).toBe(401)
    expect((await POST(request(
      { id: PROVIDER_ID, status: 'sent' },
      { auth: null },
    ))).status).toBe(401)
    const queryOnly = request(
      { id: PROVIDER_ID, status: 'sent' },
      { auth: null, queryKey: 'callback-secret' },
    )
    expect((await POST(queryOnly)).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('failar stängt när callback-hemligheten saknas i serverkonfigurationen', async () => {
    delete process.env.SMS_46ELKS_CALLBACK_SECRET
    expect((await POST(request({ id: PROVIDER_ID, status: 'sent' }))).status).toBe(503)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('accepterar endast POST form-urlencoded med exakt dokumenterade fält', async () => {
    expect(
      (await POST(request({ id: PROVIDER_ID, status: 'sent' }, { contentType: 'application/json' }))).status,
    ).toBe(415)
    expect((await POST(request({ id: 'guess', status: 'sent' }))).status).toBe(400)
    expect((await POST(request({ id: PROVIDER_ID, status: 'created' }))).status).toBe(400)
    expect(
      (await POST(request({ id: PROVIDER_ID, status: 'delivered' }))).status,
    ).toBe(400)
    expect(
      (await POST(request({ id: PROVIDER_ID, status: 'sent', delivered: '2026-07-18T10:00:00Z' }))).status,
    ).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('skriver levererad status genom service-role-RPC och skickar provider att sluta retrya', async () => {
    const response = await POST(
      request({
        id: PROVIDER_ID,
        status: 'delivered',
        delivered: '2026-07-18T10:00:00Z',
      }),
    )
    expect(response.status).toBe(204)
    expect(rpc).toHaveBeenCalledWith('record_sms_delivery', {
      p_provider_ref: PROVIDER_ID,
      p_status: 'delivered',
      p_delivered_at: '2026-07-18T10:00:00.000Z',
    })
  })

  it('replay är idempotent men okänt provider-id/cross-tenant-gissning nekas', async () => {
    rpc.mockResolvedValueOnce({ data: 'idempotent', error: null })
    expect((await POST(request({ id: PROVIDER_ID, status: 'sent' }))).status).toBe(204)

    rpc.mockResolvedValueOnce({ data: 'unknown_provider', error: null })
    expect((await POST(request({ id: PROVIDER_ID, status: 'sent' }))).status).toBe(404)
  })

  it('returnerar retrybart 500 vid DB-fel utan att logga key eller payload', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'db failed callback-secret' } })
    const response = await POST(
      request({ id: PROVIDER_ID, status: 'delivered', delivered: '2026-07-18T10:00:00Z' }),
    )
    expect(response.status).toBe(500)
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('callback-secret')
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain(PROVIDER_ID)
  })

  it('request-URL och applikationsloggar innehåller aldrig callback-credential', async () => {
    const callback = request({ id: PROVIDER_ID, status: 'sent' })
    expect(callback.url).toBe('https://booking.corevo.se/api/webhooks/46elks/delivery')
    await POST(callback)
    expect(JSON.stringify(mocks.info.mock.calls)).not.toContain('callback-secret')
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('callback-secret')
  })
})
