import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyCancelToken: vi.fn(),
  createPublicClient: vi.fn(),
  rpc: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
}))

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))
vi.mock('@/lib/booking/cancel-token', () => ({ verifyCancelToken: mocks.verifyCancelToken }))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: mocks.createPublicClient }))
vi.mock('@/lib/tenant-data', () => ({ currentTenant: vi.fn() }))
vi.mock('@/lib/release/commerce', () => ({ commerceReleaseGate: vi.fn() }))
vi.mock('@/components/kund/GoogleReviewNudge', () => ({ GoogleReviewNudge: () => null }))

import ConfirmationPage from './page'

const bookingId = '323e4567-e89b-42d3-a456-426614174000'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createPublicClient.mockReturnValue({ rpc: mocks.rpc })
})

describe('/boka/bekraftelse/[id] capability guard', () => {
  it.each([
    ['missing', undefined],
    ['invalid', 'invalid-token'],
  ])('fails closed for a %s token before reading the booking', async (_, token) => {
    mocks.verifyCancelToken.mockResolvedValue(false)

    await expect(ConfirmationPage({
      params: Promise.resolve({ id: bookingId }),
      searchParams: Promise.resolve({ t: token }),
    })).rejects.toThrow('NEXT_NOT_FOUND')

    expect(mocks.verifyCancelToken).toHaveBeenCalledWith(bookingId, token)
    expect(mocks.notFound).toHaveBeenCalledOnce()
    expect(mocks.createPublicClient).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
