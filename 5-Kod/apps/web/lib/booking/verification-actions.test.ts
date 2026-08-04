import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getBookingContactMode: vi.fn(),
  getPublicBookingContext: vi.fn(),
  publicBookingIsLive: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/notifications/giada', () => ({ getBookingContactMode: mocks.getBookingContactMode }))
vi.mock('./public-context', () => ({
  getPublicBookingContext: mocks.getPublicBookingContext,
  publicBookingIsLive: mocks.publicBookingIsLive,
}))

import { getBookingContactModeAction } from './verification-actions'

describe('getBookingContactModeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPublicBookingContext.mockResolvedValue({ tenantId: 'tenant-1' })
    mocks.publicBookingIsLive.mockResolvedValue(true)
    mocks.createServiceClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: mocks.maybeSingle }),
        }),
      }),
    })
    mocks.getBookingContactMode.mockResolvedValue('email')
  })

  it.each(['passwordless_tenant', 'legacy_account', 'off', 'global_account'])
  ('keeps a live guest booking contactable when the portal mode is %s', async (mode) => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        settings: {
          customer_portal: { mode },
          booking: { verificationMode: 'email_only' },
        },
      },
      error: null,
    })

    await expect(getBookingContactModeAction()).resolves.toEqual({ mode: 'email' })
    expect(mocks.getBookingContactMode).toHaveBeenCalledWith('email_only')
  })
})
