import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import { GET } from './route'

const request = (secret = 'test-secret') =>
  new Request('https://booking.corevo.se/api/cron/pending-expiry', {
    headers: { authorization: `Bearer ${secret}` },
  })

describe('pending-expiry cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('rensar bokningspending, reservationer, kontaktretention och portalens kortlivade kontaktdata', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: 3, error: null })
      .mockResolvedValueOnce({ data: 5, error: null })
      .mockResolvedValueOnce({ data: 7, error: null })
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({ data: 4, error: null })
    mocks.createServiceClient.mockReturnValue({ rpc })

    const response = await GET(request())
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      swept: 3,
      shopReservationsPruned: 5,
      slotHoldsPruned: 7,
      contactMessagesPruned: 2,
      portalContactChangesScrubbed: 4,
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'expire_abandoned_pending_bookings', { p_ttl_min: 30 })
    expect(rpc).toHaveBeenNthCalledWith(2, 'prune_expired_shop_reserves')
    expect(rpc).toHaveBeenNthCalledWith(3, 'prune_expired_slot_holds')
    expect(rpc).toHaveBeenNthCalledWith(4, 'prune_contact_messages', { p_months: 18 })
    expect(rpc).toHaveBeenNthCalledWith(5, 'sweep_customer_portal_contact_changes')
  })

  it('svarar 500 när någon DB-svepning misslyckas', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'db down' } })
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: 0, error: null })
    mocks.createServiceClient.mockReturnValue({ rpc })
    const response = await GET(request())
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'cron_degraded',
      failed: ['bookings'],
    })
  })

  it('rapporterar maskinläsbart degraded och 500 om retention eller slot-holds fallerar', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: 3, error: null })
      .mockResolvedValueOnce({ data: 5, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'function does not exist' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'function missing' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'portal retention failed' } })
    mocks.createServiceClient.mockReturnValue({ rpc })
    const response = await GET(request())
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'cron_degraded',
      failed: ['slot_holds', 'contact_messages', 'portal_contact_changes'],
    })
  })

  it('svarar 503 när serviceklienten saknas', async () => {
    mocks.createServiceClient.mockReturnValue(null)
    expect((await GET(request())).status).toBe(503)
  })
})
