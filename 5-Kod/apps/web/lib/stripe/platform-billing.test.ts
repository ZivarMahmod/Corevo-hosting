import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stripeTest: {
    customers: { create: vi.fn(), retrieve: vi.fn() },
    invoices: { create: vi.fn(), retrieve: vi.fn() },
    invoiceItems: { create: vi.fn() },
  },
  stripeLive: {
    customers: { create: vi.fn(), retrieve: vi.fn() },
    invoices: { create: vi.fn(), retrieve: vi.fn() },
    invoiceItems: { create: vi.fn() },
  },
  rpc: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class MockStripe {
    static createFetchHttpClient() { return {} }
    constructor(key: string) {
      return key.startsWith('sk_live_') ? mocks.stripeLive : mocks.stripeTest
    }
  },
}))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import {
  createPlatformBillingDraft,
  reconcilePlatformBillingJob,
} from './platform-billing'

const originalMode = process.env.STRIPE_PLATFORM_BILLING_MODE
const originalKey = process.env.STRIPE_PLATFORM_BILLING_SECRET_KEY
const originalTestKey = process.env.STRIPE_PLATFORM_BILLING_TEST_SECRET_KEY
const originalLiveKey = process.env.STRIPE_PLATFORM_BILLING_LIVE_SECRET_KEY

afterAll(() => {
  if (originalMode === undefined) delete process.env.STRIPE_PLATFORM_BILLING_MODE
  else process.env.STRIPE_PLATFORM_BILLING_MODE = originalMode
  if (originalKey === undefined) delete process.env.STRIPE_PLATFORM_BILLING_SECRET_KEY
  else process.env.STRIPE_PLATFORM_BILLING_SECRET_KEY = originalKey
  if (originalTestKey === undefined) delete process.env.STRIPE_PLATFORM_BILLING_TEST_SECRET_KEY
  else process.env.STRIPE_PLATFORM_BILLING_TEST_SECRET_KEY = originalTestKey
  if (originalLiveKey === undefined) delete process.env.STRIPE_PLATFORM_BILLING_LIVE_SECRET_KEY
  else process.env.STRIPE_PLATFORM_BILLING_LIVE_SECRET_KEY = originalLiveKey
})

describe('platform Stripe Billing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_PLATFORM_BILLING_MODE = 'test'
    process.env.STRIPE_PLATFORM_BILLING_SECRET_KEY = 'sk_test_corevo'
    delete process.env.STRIPE_PLATFORM_BILLING_TEST_SECRET_KEY
    delete process.env.STRIPE_PLATFORM_BILLING_LIVE_SECRET_KEY
    mocks.rpc.mockImplementation((name: string) => Promise.resolve({
      data: name === 'platform_billing_webhook_event'
        ? { eventType: 'invoice.updated', objectId: 'in_1', livemode: false }
        : true,
      error: null,
    }))
    mocks.createServiceClient.mockReturnValue({ rpc: mocks.rpc })
  })

  it('creates only a non-advancing platform draft with stable idempotency keys', async () => {
    mocks.stripeTest.customers.create.mockResolvedValue({ id: 'cus_1', livemode: false })
    mocks.stripeTest.invoices.create.mockResolvedValue({
      id: 'in_1', customer: 'cus_1', livemode: false, status: 'draft', total: 0,
    })
    mocks.stripeTest.invoiceItems.create.mockImplementation(async () => {
      expect(mocks.rpc.mock.calls.some(([, args]) => (
        args?.p_invoice_id === 'in_1'
      ))).toBe(false)
      return { id: 'ii_1' }
    })
    mocks.stripeTest.invoices.retrieve.mockResolvedValue({
      id: 'in_1', customer: 'cus_1', livemode: false, status: 'draft', total: 1500,
    })

    await expect(createPlatformBillingDraft({
      periodId: 'period-1',
      tenantId: 'tenant-1',
      tenantName: 'Corevo Kund',
      orgNr: '559000-0000',
      periodStart: '2026-08-01',
      periodEnd: '2026-09-01',
      totalCents: 1500,
      currency: 'sek',
      existingCustomerId: null,
      existingInvoiceId: null,
    })).resolves.toEqual({ invoiceId: 'in_1', status: 'draft', livemode: false })

    expect(mocks.stripeTest.invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        auto_advance: false,
        collection_method: 'send_invoice',
        pending_invoice_items_behavior: 'exclude',
      }),
      expect.objectContaining({
        idempotencyKey: 'corevo:billing:invoice:test:tenant-1:2026-08-01',
      }),
    )
    expect(mocks.stripeTest.invoices.create.mock.calls[0]?.[1]).not.toHaveProperty('stripeAccount')
    expect(mocks.stripeTest.invoiceItems.create.mock.calls[0]?.[1]).not.toHaveProperty('stripeAccount')
    expect(mocks.rpc).toHaveBeenCalledWith('attach_platform_billing_draft', expect.objectContaining({
      p_invoice_id: 'in_1',
    }))
  })

  it('replaces a deleted carried customer before creating the period draft', async () => {
    mocks.stripeTest.customers.retrieve.mockResolvedValue({ id: 'cus_old', deleted: true })
    mocks.stripeTest.customers.create.mockResolvedValue({ id: 'cus_new', livemode: false })
    mocks.stripeTest.invoices.create.mockResolvedValue({
      id: 'in_1', customer: 'cus_new', livemode: false, status: 'draft', total: 1500,
    })

    await createPlatformBillingDraft({
      periodId: 'period-1', tenantId: 'tenant-1', tenantName: 'Corevo Kund', orgNr: null,
      periodStart: '2026-08-01', periodEnd: '2026-09-01', totalCents: 1500,
      currency: 'sek', existingCustomerId: 'cus_old', existingInvoiceId: null,
    })

    expect(mocks.stripeTest.invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_new' }),
      expect.anything(),
    )
    expect(mocks.rpc).toHaveBeenCalledWith('attach_platform_billing_draft', expect.objectContaining({
      p_customer_id: 'cus_new',
    }))
  })

  it('reconciles duplicate or reversed events from the current Stripe object', async () => {
    mocks.stripeTest.invoices.retrieve.mockResolvedValue({
      id: 'in_1', customer: 'cus_1', livemode: false, status: 'paid', total: 1500,
    })
    mocks.stripeTest.customers.retrieve.mockResolvedValue({ id: 'cus_1' })

    await reconcilePlatformBillingJob({
      v: 1, type: 'stripe.billing.reconcile', eventId: 'evt_new', objectId: 'in_1',
    })
    await reconcilePlatformBillingJob({
      v: 1, type: 'stripe.billing.reconcile', eventId: 'evt_old', objectId: 'in_1',
    })

    expect(mocks.rpc).toHaveBeenCalledTimes(4)
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'reconcile_platform_billing_invoice', {
      p_invoice_id: 'in_1',
      p_customer_id: 'cus_1',
      p_invoice_status: 'paid',
      p_livemode: false,
      p_total_cents: 1500,
    })
    expect(mocks.stripeTest.invoices.retrieve).toHaveBeenCalledWith('in_1')
    expect(mocks.stripeTest.customers.retrieve).toHaveBeenCalledWith('cus_1')
  })

  it('uses the event livemode client for a queued test event after a live mode switch', async () => {
    process.env.STRIPE_PLATFORM_BILLING_MODE = 'draft'
    process.env.STRIPE_PLATFORM_BILLING_SECRET_KEY = 'sk_live_corevo'
    process.env.STRIPE_PLATFORM_BILLING_TEST_SECRET_KEY = 'sk_test_corevo'
    mocks.stripeTest.invoices.retrieve.mockResolvedValue({
      id: 'in_1', customer: 'cus_1', livemode: false, status: 'paid', total: 1500,
    })
    mocks.stripeTest.customers.retrieve.mockResolvedValue({ id: 'cus_1' })

    await reconcilePlatformBillingJob({
      v: 1, type: 'stripe.billing.reconcile', eventId: 'evt_test', objectId: 'in_1',
    })

    expect(mocks.stripeTest.invoices.retrieve).toHaveBeenCalledWith('in_1')
    expect(mocks.stripeLive.invoices.retrieve).not.toHaveBeenCalled()
  })

  it('marks a deleted draft from stored event metadata without retrieving it', async () => {
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({
      data: name === 'platform_billing_webhook_event'
        ? { eventType: 'invoice.deleted', objectId: 'in_1', livemode: false }
        : true,
      error: null,
    }))
    mocks.createServiceClient.mockReturnValue({ rpc })

    await reconcilePlatformBillingJob({
      v: 1, type: 'stripe.billing.reconcile', eventId: 'evt_deleted', objectId: 'in_1',
    })

    expect(mocks.stripeTest.invoices.retrieve).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenLastCalledWith('reconcile_platform_billing_invoice', {
      p_invoice_id: 'in_1',
      p_customer_id: null,
      p_invoice_status: 'deleted',
      p_livemode: false,
      p_total_cents: null,
    })
  })
})
