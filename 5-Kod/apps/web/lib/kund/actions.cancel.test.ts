import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getMyBooking: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
  requirePortal: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requirePortal: mocks.requirePortal }))
vi.mock('./admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('./bookings', () => ({ getMyBooking: mocks.getMyBooking }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('./settings', () => ({
  getCancellationCutoffHours: vi.fn(async () => 24),
  withinCancellationWindow: vi.fn(() => true),
}))
vi.mock('@/lib/notifications/booking-events', () => ({
  queueBookingEvent: vi.fn(async () => ({ state: 'queued', channel: 'email', inserted: true })),
}))

import { cancelBooking } from './actions'

const bookingId = '123e4567-e89b-42d3-a456-426614174000'
const tenantId = '223e4567-e89b-42d3-a456-426614174000'
const customerId = '323e4567-e89b-42d3-a456-426614174000'
const userId = '423e4567-e89b-42d3-a456-426614174000'

describe('signed-in customer cancellation action', () => {
  const rpc = vi.fn()
  const maybeSingle = vi.fn(async () => ({ data: { id: bookingId }, error: null }))
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    maybeSingle,
    or: vi.fn(() => query),
    select: vi.fn(() => query),
    update: vi.fn(() => query),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requirePortal.mockResolvedValue({ id: userId, tenantId })
    mocks.getMyBooking.mockResolvedValue({
      id: bookingId,
      status: 'confirmed',
      startTs: '2030-01-02T10:00:00.000Z',
      customerId,
    })
    rpc.mockResolvedValue({
      data: [{ outcome: 'cancelled', booking_status: 'cancelled', refund_job_id: null }],
      error: null,
    })
    mocks.createClient.mockResolvedValue({})
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query), rpc })
  })

  it('does not invoke the mutation RPC when the booking is not owned by the customer', async () => {
    mocks.getMyBooking.mockResolvedValue(null)
    const formData = new FormData()
    formData.set('bookingId', bookingId)

    await expect(cancelBooking({}, formData)).resolves.toEqual({
      error: 'Bokningen hittades inte.',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('delegates an owned booking and returns to the account without notification query state', async () => {
    const formData = new FormData()
    formData.set('bookingId', bookingId)

    await expect(cancelBooking({}, formData)).rejects.toThrow('NEXT_REDIRECT:/konto')
    expect(rpc).toHaveBeenCalledWith('cancel_verified_customer_booking', {
      p_tenant: tenantId,
      p_booking: bookingId,
      p_customer: customerId,
      p_customer_profile: userId,
    })
    expect(mocks.redirect).toHaveBeenCalledWith('/konto')
  })
})
