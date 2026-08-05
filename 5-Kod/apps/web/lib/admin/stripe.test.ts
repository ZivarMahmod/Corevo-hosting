import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  organizationOwnerCtx: vi.fn(),
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  getStripe: vi.fn(),
  createExpressAccount: vi.fn(),
  createOnboardingLink: vi.fn(),
  fetchConnectStatus: vi.fn(),
  requestOrigin: vi.fn(),
  commerceReleaseGate: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTenant: vi.fn(),
}))

vi.mock('@/lib/admin/module-ctx', () => ({
  organizationOwnerCtx: mocks.organizationOwnerCtx,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/stripe/client', () => ({ getStripe: mocks.getStripe }))
vi.mock('@/lib/stripe/connect', () => ({
  createExpressAccount: mocks.createExpressAccount,
  createOnboardingLink: mocks.createOnboardingLink,
  fetchConnectStatus: mocks.fetchConnectStatus,
}))
vi.mock('@/lib/url', () => ({ requestOrigin: mocks.requestOrigin }))
vi.mock('@/lib/release/commerce', () => ({ commerceReleaseGate: mocks.commerceReleaseGate }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('./tenant', () => ({ revalidateTenant: mocks.revalidateTenant }))

import {
  refreshStripeStatus,
  setPaymentsEnabled,
  startStripeOnboarding,
} from './stripe'

function fd(entries: Record<string, string> = {}): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(entries)) form.set(key, value)
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.organizationOwnerCtx.mockResolvedValue(null)
  mocks.getStripe.mockReturnValue(null)
  mocks.commerceReleaseGate.mockReturnValue({ bookingPayment: true })
  mocks.createClient.mockResolvedValue({})
  mocks.createServiceClient.mockReturnValue({
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })
})

describe('Stripe organization-owner fence', () => {
  it.each([
    ['start onboarding', () => startStripeOnboarding({}, fd())],
    ['refresh status', () => refreshStripeStatus({}, fd())],
    ['toggle payments', () => setPaymentsEnabled({}, fd({ payments_enabled: 'false' }))],
  ])('denies a location-scoped admin before clients or providers: %s', async (_name, action) => {
    await expect(action()).resolves.toEqual({
      error: 'Inget företag är kopplat till ditt konto.',
    })

    expect(mocks.organizationOwnerCtx).toHaveBeenCalledOnce()
    expect(mocks.getStripe).not.toHaveBeenCalled()
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.createExpressAccount).not.toHaveBeenCalled()
    expect(mocks.createOnboardingLink).not.toHaveBeenCalled()
    expect(mocks.fetchConnectStatus).not.toHaveBeenCalled()
    expect(mocks.requestOrigin).not.toHaveBeenCalled()
    expect(mocks.revalidateTenant).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
