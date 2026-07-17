import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendEmail, loadEmailBrand, warn } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  loadEmailBrand: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('./email', () => ({ sendEmail }))
vi.mock('./brand', () => ({ loadEmailBrand }))
vi.mock('@/lib/observability', () => ({
  logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const { deliverIssuedGiftCards } = await import('./gift')

const gift = {
  id: 'g1',
  code: 'COREVO-123',
  initial_amount_cents: 50000,
  currency: 'SEK',
  delivery_mode: 'email',
  recipient_name: 'Ada',
  recipient_email: 'ada@example.com',
  message: null,
}

type Filter = [column: string, value: unknown]

function giftClient() {
  const updates: Record<string, unknown>[] = []
  const releaseFilters: Filter[] = []

  const client = {
    from(table: string) {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { name: 'Corevo Demo' }, error: null }),
            }),
          }),
        }
      }
      if (table !== 'gift_cards') throw new Error(`unexpected table: ${table}`)
      return {
        update(patch: Record<string, unknown>) {
          updates.push(patch)
          if (patch.emailed_at === null) {
            const release = {
              eq(column: string, value: unknown) {
                releaseFilters.push([column, value])
                return release
              },
              then(resolve: (value: { error: null }) => unknown) {
                return Promise.resolve({ error: null }).then(resolve)
              },
            }
            return release
          }

          const claim = {
            eq: () => claim,
            is: () => claim,
            select: async () => ({ data: [gift], error: null }),
          }
          return claim
        },
      }
    },
  }

  return { client, updates, releaseFilters }
}

beforeEach(() => {
  sendEmail.mockReset()
  loadEmailBrand.mockReset()
  warn.mockReset()
  loadEmailBrand.mockResolvedValue({
    from: 'Corevo <booking@corevo.se>',
    replyTo: undefined,
    accentColor: undefined,
    logoUrl: null,
    slogan: undefined,
  })
})

describe('deliverIssuedGiftCards', () => {
  it('släpper sin egen claim med CAS när mejlleveransen misslyckas', async () => {
    sendEmail.mockResolvedValue({ ok: false, error: 'relay_down' })
    const { client, updates, releaseFilters } = giftClient()

    await deliverIssuedGiftCards(client as never, 't1', 'o1')

    const claimedAt = updates[0]?.emailed_at
    expect(claimedAt).toEqual(expect.any(String))
    expect(updates).toEqual([{ emailed_at: claimedAt }, { emailed_at: null }])
    expect(releaseFilters).toEqual([
      ['id', 'g1'],
      ['tenant_id', 't1'],
      ['order_id', 'o1'],
      ['emailed_at', claimedAt],
    ])
  })

  it('behåller emailed_at när mejlet skickades', async () => {
    sendEmail.mockResolvedValue({ ok: true })
    const { client, updates, releaseFilters } = giftClient()

    await deliverIssuedGiftCards(client as never, 't1', 'o1')

    expect(updates).toHaveLength(1)
    expect(updates[0]?.emailed_at).toEqual(expect.any(String))
    expect(releaseFilters).toEqual([])
  })

  it('behåller claimen vid ett oväntat kast med okänd leveransstatus', async () => {
    sendEmail.mockRejectedValue(new Error('relay crashed'))
    const { client, updates, releaseFilters } = giftClient()

    await deliverIssuedGiftCards(client as never, 't1', 'o1')

    expect(updates).toHaveLength(1)
    expect(updates[0]?.emailed_at).toEqual(expect.any(String))
    expect(releaseFilters).toEqual([])
  })
})
