import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  noStore: vi.fn(),
  revalidatePath: vi.fn(),
  cancelPortalBooking: vi.fn(),
}))

vi.mock('next/cache', () => ({
  unstable_noStore: mocks.noStore,
  revalidatePath: mocks.revalidatePath,
}))
vi.mock('@/lib/customer-portal/actions', () => ({
  cancelPortalBooking: mocks.cancelPortalBooking,
}))

import { cancelPortalBookingAction } from './actions'

const input = {
  bookingPublicId: '123e4567-e89b-42d3-a456-426614174000',
  expectedCutoffHours: 24,
  idempotencyKey: '223e4567-e89b-42d3-a456-426614174000',
}

describe('portal route cancellation action', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(['success', 'policy_blocked', 'unavailable'] as const)(
    'returns %s without sending an eager RSC revalidation patch',
    async (outcome) => {
      mocks.cancelPortalBooking.mockResolvedValue({ outcome })
      await expect(cancelPortalBookingAction(input)).resolves.toEqual({ outcome })
      expect(mocks.noStore).toHaveBeenCalledOnce()
      expect(mocks.cancelPortalBooking).toHaveBeenCalledWith(input)
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    },
  )
})
