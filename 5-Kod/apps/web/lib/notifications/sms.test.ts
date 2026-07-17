import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sendSms, toE164, sanitizeSenderId, parseGuestPhone } from './sms'

// Plan 006: 46elks-transporten. Samma env-disciplin som email.test.ts — läser
// process.env vid ANROP, så varje test sätter/återställer explicit. fetch mockas;
// inga riktiga SMS kan skickas härifrån.

const ELKS_VARS = ['SMS_46ELKS_USERNAME', 'SMS_46ELKS_PASSWORD'] as const

describe('toE164', () => {
  it('normaliserar svenska nationella nummer', () => {
    expect(toE164('0701234567')).toBe('+46701234567')
    expect(toE164('070-123 45 67')).toBe('+46701234567')
  })
  it('konverterar 00-prefix och behåller befintligt +', () => {
    expect(toE164('0046701234567')).toBe('+46701234567')
    expect(toE164('+46 70 123 45 67')).toBe('+46701234567')
    expect(toE164('+4512345678')).toBe('+4512345678')
  })
  it('vägrar tvetydigt skräp (skicka aldrig till en gissning)', () => {
    expect(toE164('12345')).toBeNull()
    expect(toE164('abc')).toBeNull()
    expect(toE164('')).toBeNull()
  })
})

describe('sanitizeSenderId', () => {
  it('strippar otillåtna tecken och klipper till 11', () => {
    expect(sanitizeSenderId('Fresh Cut!')).toBe('FreshCut')
    expect(sanitizeSenderId('Hantverksfloristerna')).toBe('Hantverksfl')
  })
  it('tomt/åäö-bara namn faller tillbaka på Corevo', () => {
    expect(sanitizeSenderId('')).toBe('Corevo')
    expect(sanitizeSenderId(undefined)).toBe('Corevo')
    expect(sanitizeSenderId('åäö')).toBe('Corevo')
  })
})

describe('sendSms (46elks-transport)', () => {
  let saved: Record<string, string | undefined>
  const fetchMock = vi.fn()

  beforeEach(() => {
    saved = {}
    for (const k of ELKS_VARS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    for (const k of ELKS_VARS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
    vi.unstubAllGlobals()
  })

  it('no-op med skipped:true utan credentials — ingen fetch', async () => {
    const res = await sendSms({ to: '0701234567', body: 'Hej' })
    expect(res).toEqual({ ok: false, skipped: true, error: 'transport_unavailable' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('vägrar ogiltig mottagare utan att kontakta providern', async () => {
    process.env.SMS_46ELKS_USERNAME = 'u'
    process.env.SMS_46ELKS_PASSWORD = 'p'
    expect(await sendSms({ to: 'inte-ett-nummer', body: 'Hej' })).toEqual({
      ok: false,
      error: 'invalid_recipient',
    })
    expect(await sendSms({ to: '12345', body: 'Hej' })).toEqual({
      ok: false,
      error: 'invalid_recipient',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('vägrar tom body', async () => {
    expect(await sendSms({ to: '0701234567', body: '  ' })).toEqual({
      ok: false,
      error: 'empty_body',
    })
  })

  it('POSTar till 46elks med Basic auth + form-encoding + sanerad avsändare', async () => {
    process.env.SMS_46ELKS_USERNAME = 'user'
    process.env.SMS_46ELKS_PASSWORD = 'pass'
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 })

    const res = await sendSms({ to: '070-123 45 67', body: 'Din tid är bokad', from: 'Fresh Cut!' })
    expect(res).toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.46elks.com/a1/sms')
    expect(init.method).toBe('POST')
    expect(init.headers.authorization).toBe(`Basic ${btoa('user:pass')}`)
    expect(init.headers['content-type']).toBe('application/x-www-form-urlencoded')
    const body = init.body as URLSearchParams
    expect(body.get('from')).toBe('FreshCut')
    expect(body.get('to')).toBe('+46701234567')
    expect(body.get('message')).toBe('Din tid är bokad')
  })

  it('icke-2xx → typat fel, kastar aldrig', async () => {
    process.env.SMS_46ELKS_USERNAME = 'u'
    process.env.SMS_46ELKS_PASSWORD = 'p'
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    expect(await sendSms({ to: '0701234567', body: 'Hej' })).toEqual({
      ok: false,
      error: 'http_500',
    })
  })

  it('fetch som kastar → typat fel, kastar aldrig uppåt', async () => {
    process.env.SMS_46ELKS_USERNAME = 'u'
    process.env.SMS_46ELKS_PASSWORD = 'p'
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    expect(await sendSms({ to: '0701234567', body: 'Hej' })).toEqual({
      ok: false,
      error: 'exception',
    })
  })
})

describe('parseGuestPhone (oförändrat kontrakt)', () => {
  it('plockar telefonen ur gäst-noten', () => {
    expect(parseGuestPhone('Gäst: Anna <anna@mail.se> 070-123 45 67 — vill ha kort')).toBe(
      '070-123 45 67',
    )
  })
  it('null när telefon saknas', () => {
    expect(parseGuestPhone('Gäst: Anna <anna@mail.se>')).toBeNull()
    expect(parseGuestPhone(null)).toBeNull()
  })
})
