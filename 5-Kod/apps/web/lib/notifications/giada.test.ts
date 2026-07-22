import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getBookingContactMode, sendGiadaMessage } from './giada'

const ENV = { ...process.env }

beforeEach(() => {
  process.env.GIADA_SMS_BASE_URL = 'https://sms.corevo.se'
  process.env.GIADA_SMS_API_KEY = 'test-secret'
  process.env.GIADA_HEALTH_MAX_AGE_SECONDS = '90'
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-21T12:00:00.000Z'))
})

afterEach(() => {
  process.env = { ...ENV }
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('getBookingContactMode', () => {
  it('väljer sms endast när health är ok, modemet online och svaret färskt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'ok',
      modem_online: true,
      time: '2026-07-21T11:59:30.000Z',
    }), { status: 200 })))

    await expect(getBookingContactMode()).resolves.toBe('sms')
  })

  it.each([
    ['offline', { status: 'ok', modem_online: false, time: '2026-07-21T11:59:30.000Z' }],
    ['stale', { status: 'ok', modem_online: true, time: '2026-07-21T11:57:00.000Z' }],
    ['fel status', { status: 'degraded', modem_online: true, time: '2026-07-21T11:59:30.000Z' }],
  ])('väljer e-post vid %s health', async (_name, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })))

    await expect(getBookingContactMode()).resolves.toBe('email')
  })

  it('väljer e-post vid timeout, HTTP-fel eller saknad konfiguration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout +46701234567')))
    await expect(getBookingContactMode()).resolves.toBe('email')

    process.env.GIADA_SMS_API_KEY = ''
    await expect(getBookingContactMode()).resolves.toBe('email')
  })
})

describe('sendGiadaMessage', () => {
  it('skickar secret bara i header och kräver online modem med stabil idempotens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      id: 42,
      created: true,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendGiadaMessage({
      to: '+46701234567',
      message: 'Din kod är 123456',
      idempotencyKey: 'pin:challenge-1',
      expiresAt: '2026-07-21T12:05:00.000Z',
    })).resolves.toEqual({ ok: true, id: 42, created: true })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://sms.corevo.se/api/v1/messages')
    expect(init.headers).toMatchObject({ 'X-API-Key': 'test-secret' })
    expect(JSON.parse(String(init.body))).toEqual({
      to: '+46701234567',
      message: 'Din kod är 123456',
      idempotency_key: 'pin:challenge-1',
      require_online: true,
      expires_at: '2026-07-21T12:05:00.000Z',
    })
    expect(String(init.body)).not.toContain('test-secret')
    expect(init.signal).toBeDefined()
  })

  it('klassificerar offline utan att kasta eller läcka kontaktdata i logg', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: 'modem_offline',
    }), { status: 503 })))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendGiadaMessage({
      to: '+46701234567',
      message: 'Kod 123456',
      idempotencyKey: 'pin:challenge-2',
    })).resolves.toEqual({ ok: false, reason: 'offline' })
    expect(warn.mock.calls.flat().join(' ')).not.toContain('+46701234567')
  })
})
