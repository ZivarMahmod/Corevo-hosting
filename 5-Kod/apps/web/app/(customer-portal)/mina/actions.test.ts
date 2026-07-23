import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  noStore: vi.fn(),
  revalidatePath: vi.fn(),
  cancelPortalBooking: vi.fn(),
  updatePortalCustomerName: vi.fn(),
  logoutCurrentPortalSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  unstable_noStore: mocks.noStore,
  revalidatePath: mocks.revalidatePath,
}))
vi.mock('@/lib/customer-portal/actions', () => ({
  cancelPortalBooking: mocks.cancelPortalBooking,
}))
vi.mock('@/lib/customer-portal/profile', () => ({
  updatePortalCustomerName: mocks.updatePortalCustomerName,
}))
vi.mock('@/lib/customer-portal/logout', () => ({
  logoutCurrentPortalSession: mocks.logoutCurrentPortalSession,
}))

import { cancelPortalBookingAction, logoutPortalAction, updatePortalNameAction } from './actions'

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

  it('keeps profile mutations behind no-store server actions without eager route refreshes', async () => {
    mocks.updatePortalCustomerName.mockResolvedValue({ outcome: 'success', name: 'Alex Test' })
    mocks.logoutCurrentPortalSession.mockResolvedValue({ ok: true, tenantSlug: 'freshcut' })
    await expect(updatePortalNameAction(' Alex Test ')).resolves.toEqual({
      outcome: 'success', name: 'Alex Test',
    })
    await expect(logoutPortalAction()).resolves.toEqual({ ok: true, tenantSlug: 'freshcut' })
    expect(mocks.updatePortalCustomerName).toHaveBeenCalledWith(' Alex Test ')
    expect(mocks.logoutCurrentPortalSession).toHaveBeenCalledOnce()
    expect(mocks.noStore).toHaveBeenCalledTimes(2)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})
