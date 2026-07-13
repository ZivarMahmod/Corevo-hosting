import { describe, it, expect, vi, beforeEach } from 'vitest'

// KONTAKT-INTAKENS SÄKERHETSKONTRAKT (goal-64).
//
// Det här är den enda anonyma skrivningen som finns på VARJE mall — /kontakt är ingen
// modul och kan inte stängas av. Testerna vaktar därför exakt de fyra sätt den kan
// bli farlig på:
//   1. tenant kommer ur MIDDLEWARE-HEADERN, aldrig ur klientens formdata
//   2. rate-limit träffar (annars är formuläret en spam-kanon mot kundens inkorg)
//   3. honeypot → TYST avvisning (ingen rad, inget mejl, inget felmeddelande)
//   4. ett mejlfel får ALDRIG krascha insändningen — raden ska ligga kvar
//
// Alla fyra gränser mockas: next/headers, @/lib/supabase/public, rate-limit, notiferaren.

const headersMock = vi.fn()
vi.mock('next/headers', () => ({ headers: () => headersMock() }))

const insertMock = vi.fn()
const createPublicClientMock = vi.fn()
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => createPublicClientMock(),
}))

const checkRateLimitMock = vi.fn()
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a),
  getClientIp: async () => '1.2.3.4',
  rateLimitKey: (...parts: string[]) => parts.join(':'),
  LIMITS: { kontakt: { max: 6, windowSecs: 300 } },
}))

const sendMock = vi.fn()
vi.mock('@/lib/notifications/kontakt', () => ({
  sendContactMessageEmail: (...a: unknown[]) => sendMock(...a),
}))

import { submitContactMessage } from './intake'
import { CONTACT_HONEYPOT, CONTACT_SUBMIT_INITIAL } from './types'

/** Supabase-stub: tenants→select-kedja som resolvar en tenant; contact_messages→insert. */
function stubClient(tenant: { id: string; slug: string; name: string } | null) {
  return {
    from: (table: string) => {
      if (table === 'tenants') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({ data: tenant }),
        }
        return chain
      }
      return { insert: (row: unknown) => insertMock(row) }
    },
  }
}

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

const TENANT = { id: 'tenant-A', slug: 'aurora', name: 'Aurora' }
const VALID = { name: 'Vera', email: 'vera@exempel.se', message: 'Hej, jag undrar en sak.' }

beforeEach(() => {
  vi.clearAllMocks()
  headersMock.mockReturnValue({ get: (k: string) => (k === 'x-corevo-tenant-slug' ? 'aurora' : null) })
  createPublicClientMock.mockReturnValue(stubClient(TENANT))
  checkRateLimitMock.mockResolvedValue(true)
  insertMock.mockResolvedValue({ error: null })
  sendMock.mockResolvedValue({ ok: true })
})

describe('submitContactMessage — tenant-isolering', () => {
  it('tar tenant ur middleware-headern, ALDRIG ur klientens formdata', async () => {
    // Klienten ljuger och skickar med en annan tenant. Den måste ignoreras.
    const res = await submitContactMessage(CONTACT_SUBMIT_INITIAL, fd({ ...VALID, tenant_id: 'ONDSKAN' }))

    expect(res).toEqual({ phase: 'done' })
    expect(insertMock).toHaveBeenCalledTimes(1)
    // Raden bär det SERVER-resolvade id:t — inte klientens.
    expect(insertMock.mock.calls[0]?.[0]).toMatchObject({ tenant_id: 'tenant-A' })
  })

  it('avvisar när middleware-headern saknas (okänd värd → ingen skrivning)', async () => {
    headersMock.mockReturnValue({ get: () => null })

    const res = await submitContactMessage(CONTACT_SUBMIT_INITIAL, fd(VALID))

    expect(res).toEqual({ phase: 'error', message: 'Okänt företag.' })
    expect(insertMock).not.toHaveBeenCalled()
  })
})

describe('submitContactMessage — rate-limit', () => {
  it('träffar: över taket → ingen rad, inget mejl', async () => {
    checkRateLimitMock.mockResolvedValue(false)

    const res = await submitContactMessage(CONTACT_SUBMIT_INITIAL, fd(VALID))

    expect(res.phase).toBe('error')
    expect(insertMock).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('bucketen är per tenant + IP (inte global)', async () => {
    await submitContactMessage(CONTACT_SUBMIT_INITIAL, fd(VALID))
    expect(checkRateLimitMock).toHaveBeenCalledWith('kontakt:tenant-A:1.2.3.4', expect.anything())
  })
})

describe('submitContactMessage — validering', () => {
  it('avvisar tom e-post OCH tomt telefonnummer (ingen väg tillbaka)', async () => {
    const res = await submitContactMessage(
      CONTACT_SUBMIT_INITIAL,
      fd({ name: 'Vera', message: 'Hej' }),
    )

    expect(res).toEqual({ phase: 'error', message: 'Lämna e-post eller telefon så vi kan nå dig.' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('avvisar ogiltig e-post', async () => {
    const res = await submitContactMessage(
      CONTACT_SUBMIT_INITIAL,
      fd({ ...VALID, email: 'inte-en-adress' }),
    )

    expect(res).toEqual({ phase: 'error', message: 'Kontrollera e-postadressen.' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('accepterar telefon utan e-post (Auroras fältuppsättning)', async () => {
    const res = await submitContactMessage(
      CONTACT_SUBMIT_INITIAL,
      fd({ name: 'Vera', phone: '070-123 45 67', message: 'Hej' }),
    )

    expect(res).toEqual({ phase: 'done' })
    expect(insertMock.mock.calls[0]?.[0]).toMatchObject({ email: null, phone: '070-123 45 67' })
  })
})

describe('submitContactMessage — honeypot', () => {
  it('ifylld honeypot → TYST avvisning: ser lyckad ut, men ingen rad och inget mejl', async () => {
    const res = await submitContactMessage(
      CONTACT_SUBMIT_INITIAL,
      fd({ ...VALID, [CONTACT_HONEYPOT]: 'https://spam.example' }),
    )

    // Boten ska tro att den lyckades — ett felmeddelande hade lärt den vad den skulle undvika.
    expect(res).toEqual({ phase: 'done' })
    expect(insertMock).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
    // Den kostar oss inte ens en rate-limit-runda.
    expect(checkRateLimitMock).not.toHaveBeenCalled()
  })
})

describe('submitContactMessage — mejlet är best-effort', () => {
  it('mejlfel kraschar INTE insändningen: raden ligger kvar, besökaren ser "done"', async () => {
    sendMock.mockRejectedValue(new Error('relay nere'))

    const res = await submitContactMessage(CONTACT_SUBMIT_INITIAL, fd(VALID))

    expect(res).toEqual({ phase: 'done' })
    expect(insertMock).toHaveBeenCalledTimes(1) // raden skrevs FÖRE mejlet och står kvar
  })

  it('DB-fel → fel, och inget mejl skickas (vi mejlar aldrig något vi inte sparat)', async () => {
    insertMock.mockResolvedValue({ error: { message: 'boom' } })

    const res = await submitContactMessage(CONTACT_SUBMIT_INITIAL, fd(VALID))

    expect(res.phase).toBe('error')
    expect(sendMock).not.toHaveBeenCalled()
  })
})
