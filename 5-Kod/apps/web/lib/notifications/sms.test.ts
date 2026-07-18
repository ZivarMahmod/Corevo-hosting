import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('@/lib/observability', () => ({
  logger: { info: mocks.info, warn: mocks.warn },
}))

import { parseSmsDeliveryMode } from './settings'
import {
  deliverSmsOutbox,
  parseGuestPhone,
  sanitizeSenderId,
  sendSms,
  toE164,
} from './sms'

const SMS_ENV = [
  'SMS_DELIVERY_MODE',
  'SMS_46ELKS_USERNAME',
  'SMS_46ELKS_PASSWORD',
  'SMS_46ELKS_CALLBACK_URL',
  'SMS_46ELKS_CALLBACK_SECRET',
  'SMS_CANARY_RECIPIENTS',
] as const

describe('parseSmsDeliveryMode', () => {
  it.each([
    [undefined, 'off'],
    ['', 'off'],
    ['wat', 'off'],
    ['LIVE', 'off'],
    ['off', 'off'],
    ['dry_run', 'dry_run'],
    ['live', 'live'],
  ] as const)('tolkar %s som %s', (value, expected) => {
    expect(parseSmsDeliveryMode(value)).toBe(expected)
  })
})

describe('telefon- och avsändarnormalisering', () => {
  it('normaliserar endast entydiga nummer till E.164', () => {
    expect(toE164('0701234567')).toBe('+46701234567')
    expect(toE164('070-123 45 67')).toBe('+46701234567')
    expect(toE164('0046701234567')).toBe('+46701234567')
    expect(toE164('+45 12 34 56 78')).toBe('+4512345678')
    expect(toE164('12345')).toBeNull()
    expect(toE164('abc')).toBeNull()
  })

  it('sanerar avsändar-id och faller tillbaka på Corevo', () => {
    expect(sanitizeSenderId('Fresh Cut!')).toBe('FreshCut')
    expect(sanitizeSenderId('Hantverksfloristerna')).toBe('Hantverksfl')
    expect(sanitizeSenderId('åäö')).toBe('Corevo')
  })
})

describe('sendSms fysisk leveransgrind', () => {
  let saved: Record<string, string | undefined>
  const fetchMock = vi.fn()

  beforeEach(() => {
    saved = {}
    for (const key of SMS_ENV) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    for (const key of SMS_ENV) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('default, tomt och okänt läge är off — även med credentials görs noll fetch', async () => {
    process.env.SMS_46ELKS_USERNAME = 'user'
    process.env.SMS_46ELKS_PASSWORD = 'pass'
    process.env.SMS_CANARY_RECIPIENTS = '+46701234567'

    for (const mode of [undefined, '', 'unknown']) {
      if (mode === undefined) delete process.env.SMS_DELIVERY_MODE
      else process.env.SMS_DELIVERY_MODE = mode
      await expect(sendSms({ to: '0701234567', body: 'Hej' })).resolves.toEqual({
        ok: false,
        skipped: true,
        mode: 'off',
        error: 'transport_off',
      })
    }

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dry_run skickar dryrun/dontlog och returnerar endast simulated kostnadsdata', async () => {
    process.env.SMS_DELIVERY_MODE = 'dry_run'
    process.env.SMS_46ELKS_USERNAME = 'user'
    process.env.SMS_46ELKS_PASSWORD = 'pass'
    process.env.SMS_CANARY_RECIPIENTS = '+46701234567'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'created', parts: 2, estimated_cost: 10_000 }),
    })

    const result = await sendSms({
      to: '070-123 45 67',
      body: 'Din tid är bokad',
      from: 'Fresh Cut!',
      tenantSmsEnabled: true,
      allowProviderDryRun: true,
    })

    expect(result).toEqual({
      ok: true,
      mode: 'dry_run',
      simulated: true,
      parts: 2,
      estimatedCost: 10_000,
      costOre: 100,
    })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.46elks.com/a1/sms')
    expect(init.headers.authorization).toBe(`Basic ${btoa('user:pass')}`)
    const body = init.body as URLSearchParams
    expect(Object.fromEntries(body)).toEqual({
      from: 'FreshCut',
      to: '+46701234567',
      message: 'Din tid är bokad',
      dryrun: 'yes',
      dontlog: 'message',
    })
    expect(body.has('whendelivered')).toBe(false)
  })

  it('dry_run vägrar oparsebart providersvar', async () => {
    process.env.SMS_DELIVERY_MODE = 'dry_run'
    process.env.SMS_46ELKS_USERNAME = 'u'
    process.env.SMS_46ELKS_PASSWORD = 'p'
    process.env.SMS_CANARY_RECIPIENTS = '+46701234567'
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'sent' }) })

    await expect(sendSms({
      to: '0701234567',
      body: 'Hej',
      tenantSmsEnabled: true,
      allowProviderDryRun: true,
    })).resolves.toEqual({
      ok: false,
      mode: 'dry_run',
      error: 'invalid_provider_response',
    })
  })

  it('dry_run är lokalt skipped som default även med opt-in, canary och credentials', async () => {
    process.env.SMS_DELIVERY_MODE = 'dry_run'
    process.env.SMS_46ELKS_USERNAME = 'u'
    process.env.SMS_46ELKS_PASSWORD = 'p'
    process.env.SMS_CANARY_RECIPIENTS = '+46701234567'

    await expect(sendSms({
      to: '0701234567',
      body: 'Hej',
      tenantSmsEnabled: true,
    })).resolves.toEqual({
      ok: false,
      skipped: true,
      mode: 'dry_run',
      error: 'dry_run_requires_explicit_canary',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('explicit outbox-dry_run kräver både tenant-opt-in och exakt canary utan fetch', async () => {
    process.env.SMS_DELIVERY_MODE = 'dry_run'
    process.env.SMS_46ELKS_USERNAME = 'u'
    process.env.SMS_46ELKS_PASSWORD = 'p'
    process.env.SMS_CANARY_RECIPIENTS = '+46701234567'

    await expect(sendSms({
      to: '0701234567',
      body: 'Hej',
      allowProviderDryRun: true,
    })).resolves.toEqual({
      ok: false,
      skipped: true,
      mode: 'dry_run',
      error: 'tenant_sms_disabled',
    })
    await expect(sendSms({
      to: '0708888888',
      body: 'Hej',
      tenantSmsEnabled: true,
      allowProviderDryRun: true,
    })).resolves.toEqual({
      ok: false,
      skipped: true,
      mode: 'dry_run',
      error: 'recipient_not_canary',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('live utan tenant-opt-in eller komplett driftkonfiguration gör noll fetch', async () => {
    process.env.SMS_DELIVERY_MODE = 'live'
    process.env.SMS_46ELKS_USERNAME = 'u'
    process.env.SMS_46ELKS_PASSWORD = 'p'
    process.env.SMS_CANARY_RECIPIENTS = '+46701234567'
    process.env.SMS_46ELKS_CALLBACK_URL = 'https://booking.corevo.se/api/webhooks/46elks/delivery'
    process.env.SMS_46ELKS_CALLBACK_SECRET = 'callback-secret'

    await expect(sendSms({ to: '0701234567', body: 'Hej' })).resolves.toEqual({
      ok: false,
      skipped: true,
      mode: 'live',
      error: 'tenant_sms_disabled',
    })

    delete process.env.SMS_46ELKS_CALLBACK_SECRET
    await expect(sendSms({ to: '0701234567', body: 'Hej', tenantSmsEnabled: true })).resolves.toEqual({
      ok: false,
      skipped: true,
      mode: 'live',
      error: 'transport_unavailable',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('live skickar endast till explicit canary och bifogar signerad delivery-url', async () => {
    process.env.SMS_DELIVERY_MODE = 'live'
    process.env.SMS_46ELKS_USERNAME = 'u'
    process.env.SMS_46ELKS_PASSWORD = 'p'
    process.env.SMS_CANARY_RECIPIENTS = '+46701234567,+46709999999'
    process.env.SMS_46ELKS_CALLBACK_URL = 'https://booking.corevo.se/api/webhooks/46elks/delivery'
    process.env.SMS_46ELKS_CALLBACK_SECRET = 'secret with spaces'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'created',
        id: 's70df59406a1b4643b96f3f91e0bfb7b0',
        parts: 1,
        cost: 3500,
      }),
    })

    const blocked = await sendSms({
      to: '0708888888',
      body: 'Hej',
      tenantSmsEnabled: true,
    })
    expect(blocked).toEqual({
      ok: false,
      skipped: true,
      mode: 'live',
      error: 'recipient_not_canary',
    })

    const sent = await sendSms({
      to: '0701234567',
      body: 'Hej',
      from: 'Corevo',
      tenantSmsEnabled: true,
    })
    expect(sent).toEqual({
      ok: true,
      mode: 'live',
      simulated: false,
      providerId: 's70df59406a1b4643b96f3f91e0bfb7b0',
      parts: 1,
      costOre: 35,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = fetchMock.mock.calls[0]![1].body as URLSearchParams
    expect(body.get('dontlog')).toBe('message')
    expect(body.get('dryrun')).toBeNull()
    expect(body.get('whendelivered')).toBe(
      'https://corevo:secret%20with%20spaces@booking.corevo.se/api/webhooks/46elks/delivery',
    )
  })

  it('fel är typade och loggar aldrig telefon, text, credentials eller providerbody', async () => {
    process.env.SMS_DELIVERY_MODE = 'dry_run'
    process.env.SMS_46ELKS_USERNAME = 'secret-user'
    process.env.SMS_46ELKS_PASSWORD = 'secret-pass'
    process.env.SMS_CANARY_RECIPIENTS = '+46701234567'
    fetchMock.mockRejectedValueOnce(
      new Error('network +46701234567 Din hemliga tid secret-user secret-pass'),
    )

    await expect(sendSms({
      to: '0701234567',
      body: 'Din hemliga tid',
      tenantSmsEnabled: true,
      allowProviderDryRun: true,
    })).resolves.toEqual({
      ok: false,
      mode: 'dry_run',
      error: 'network_error',
    })
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toMatch(
      /46701234567|Din hemliga tid|secret-user|secret-pass/,
    )
  })

  it('outbox-adaptern skiljer simulerat från skarpt och mappar retrybara fel', async () => {
    process.env.SMS_DELIVERY_MODE = 'dry_run'
    process.env.SMS_46ELKS_USERNAME = 'u'
    process.env.SMS_46ELKS_PASSWORD = 'p'
    process.env.SMS_CANARY_RECIPIENTS = '+46701234567'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'created', parts: 1, estimated_cost: 3500 }),
    })
    await expect(
      deliverSmsOutbox({ to: '0701234567', body: 'Hej', tenantSmsEnabled: true }),
    ).resolves.toEqual({ status: 'simulated', costOre: 35, parts: 1 })

    fetchMock.mockResolvedValueOnce({ ok: false, status: 429 })
    await expect(
      deliverSmsOutbox({ to: '0701234567', body: 'Hej', tenantSmsEnabled: true }),
    ).resolves.toEqual({ status: 'retry', error: 'provider_rate_limited' })

    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(
      deliverSmsOutbox({ to: '0701234567', body: 'Hej', tenantSmsEnabled: true }),
    ).resolves.toEqual({ status: 'failed', reason: 'delivery_uncertain' })
  })

  it('avbryter ett hängande provideranrop snabbt och klassar utfallet osäkert', async () => {
    vi.useFakeTimers()
    process.env.SMS_DELIVERY_MODE = 'live'
    process.env.SMS_46ELKS_USERNAME = 'u'
    process.env.SMS_46ELKS_PASSWORD = 'p'
    process.env.SMS_CANARY_RECIPIENTS = '+46701234567'
    process.env.SMS_46ELKS_CALLBACK_URL = 'https://booking.corevo.se/api/webhooks/46elks/delivery'
    process.env.SMS_46ELKS_CALLBACK_SECRET = 'callback-secret'
    fetchMock.mockImplementationOnce((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))

    const delivery = deliverSmsOutbox({
      to: '0701234567',
      body: 'Hej',
      tenantSmsEnabled: true,
    })
    await vi.advanceTimersByTimeAsync(8_000)

    await expect(delivery).resolves.toEqual({ status: 'failed', reason: 'delivery_uncertain' })
    expect((fetchMock.mock.calls[0]![1] as RequestInit).signal).toBeInstanceOf(AbortSignal)
  })
})

describe('parseGuestPhone (legacy seam)', () => {
  it('plockar telefonen ur gäst-noten utan att tolka fri text', () => {
    expect(parseGuestPhone('Gäst: Anna <anna@mail.se> 070-123 45 67 — vill ha kort')).toBe(
      '070-123 45 67',
    )
    expect(parseGuestPhone('Gäst: Anna <anna@mail.se>')).toBeNull()
  })
})
