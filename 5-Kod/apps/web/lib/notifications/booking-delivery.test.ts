import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  createCustomerClaimLink: vi.fn(),
  buildCancelToken: vi.fn(),
  buildManageUrl: vi.fn(),
  getCancellationCutoffHours: vi.fn(),
  loadEmailBrand: vi.fn(),
}))

vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/kund/customer-claim-server', () => ({
  createCustomerClaimLink: mocks.createCustomerClaimLink,
}))
vi.mock('@/lib/booking/cancel-token', () => ({
  buildCancelToken: mocks.buildCancelToken,
  buildManageUrl: mocks.buildManageUrl,
}))
vi.mock('@/lib/kund/settings', () => ({
  getCancellationCutoffHours: mocks.getCancellationCutoffHours,
}))
vi.mock('./brand', () => ({ loadEmailBrand: mocks.loadEmailBrand }))

import { prepareBookingDelivery } from './booking-delivery'
import type { ClaimedNotificationOutboxRow } from './outbox'

const row: ClaimedNotificationOutboxRow = {
  id: '30000000-0000-4000-8000-000000000001',
  tenant_id: '10000000-0000-4000-8000-000000000001',
  customer_id: '40000000-0000-4000-8000-000000000001',
  booking_id: '20000000-0000-4000-8000-000000000001',
  staff_id: '50000000-0000-4000-8000-000000000001',
  event_type: 'booking_confirmation',
  event_key: 'booking:20000000-0000-4000-8000-000000000001:confirmation',
  category: 'transactional',
  chosen_channel: 'email',
  fallback_channel: null,
  consent_state: {},
  payload: {
    template: 'booking_confirmation',
    booking_id: '20000000-0000-4000-8000-000000000001',
    occurred_at: '2030-01-01T09:00:00.000Z',
    origin: 'https://demo.corevo.se',
    include_manage_link: true,
    include_account_claim: true,
  },
  status: 'attempting',
  skip_reason: null,
  cost_ore: null,
  cost_currency: null,
  parts: null,
  provider_ref: null,
  attempt_count: 1,
  max_attempts: 5,
  available_at: '2030-01-01T09:00:00.000Z',
  lease_token: '60000000-0000-4000-8000-000000000001',
  lease_expires_at: '2030-01-01T09:02:00.000Z',
  last_error: null,
  created_at: '2030-01-01T09:00:00.000Z',
  updated_at: '2030-01-01T09:00:00.000Z',
  sent_at: null,
  delivered_at: null,
}

function service(status = 'confirmed') {
  const booking = {
    id: row.booking_id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    status,
    start_ts: '2030-01-02T10:00:00.000Z',
    services: { name: 'Klippning' },
    staff: { title: 'Alex' },
    locations: { timezone: 'Europe/Stockholm' },
    tenants: { name: 'Demo', slug: 'demo' },
    customers: {
      id: row.customer_id,
      tenant_id: row.tenant_id,
      email: 'kund@example.test',
      phone: '0701234567',
      auth_user_id: null,
    },
  }
  return {
    from(table: string) {
      if (table === 'tenant_domains') {
        const query = {
          select: () => query,
          eq: () => query,
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        }
        return query
      }
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: booking, error: null }),
      }
      return query
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createServiceClient.mockReturnValue(service())
  mocks.createCustomerClaimLink.mockResolvedValue({
    ok: true,
    url: 'https://demo.corevo.se/konto/koppla/claim-secret',
    expiresAt: '2030-01-02T09:00:00.000Z',
  })
  mocks.buildCancelToken.mockResolvedValue('cancel-secret')
  mocks.buildManageUrl.mockReturnValue(
    'https://demo.corevo.se/avboka/20000000-0000-4000-8000-000000000001?t=cancel-secret',
  )
  mocks.getCancellationCutoffHours.mockResolvedValue(24)
  mocks.loadEmailBrand.mockResolvedValue({
    from: 'Demo <hej@corevo.se>',
    replyTo: 'demo@example.test',
    accentColor: '#123456',
    logoUrl: null,
    slogan: null,
  })
})

describe('prepareBookingDelivery', () => {
  it('describes a pending request as received and explicitly not yet confirmed', async () => {
    mocks.createServiceClient.mockReturnValue(service('pending'))
    const prepared = await prepareBookingDelivery({
      ...row,
      event_type: 'booking_request_received',
      event_key: `booking:${row.booking_id}:request-received`,
      payload: { ...row.payload, template: 'booking_request_received' },
    })

    expect(prepared).toMatchObject({ ok: true, channel: 'email' })
    if (!prepared.ok || prepared.channel !== 'email') throw new Error('expected email')
    expect(prepared.subject).toContain('Bokningsförfrågan mottagen')
    expect(prepared.html).toContain('inte bekräftad än')
    expect(prepared.html).not.toContain('Bokning bekräftad')
  })

  it('mints valid manage and account links only in delivery memory', async () => {
    const prepared = await prepareBookingDelivery(row)
    expect(prepared).toMatchObject({ ok: true, channel: 'email', to: 'kund@example.test' })
    if (!prepared.ok || prepared.channel !== 'email') throw new Error('expected email')
    expect(prepared.html).toContain('/avboka/20000000-0000-4000-8000-000000000001?t=cancel-secret')
    expect(prepared.html).toContain('/konto/koppla/claim-secret')
    expect(mocks.createCustomerClaimLink).toHaveBeenCalledWith({
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      origin: 'https://demo.corevo.se',
    })
    expect(JSON.stringify(row.payload)).not.toContain('claim-secret')
    expect(JSON.stringify(row.payload)).not.toContain('cancel-secret')
  })

  it('sends SMS guests to passwordless booking management, not the login claim flow', async () => {
    mocks.createCustomerClaimLink.mockResolvedValue({
      ok: false,
      reason: 'claim_create_failed',
    })
    const prepared = await prepareBookingDelivery({
      ...row,
      chosen_channel: 'sms',
    })

    expect(prepared).toMatchObject({ ok: true, channel: 'sms' })
    if (!prepared.ok || prepared.channel !== 'sms') throw new Error('expected sms')
    expect(prepared.body).toContain(
      '/avboka/20000000-0000-4000-8000-000000000001?t=cancel-secret',
    )
    expect(prepared.body).not.toContain('/konto/koppla/')
    expect(mocks.createCustomerClaimLink).not.toHaveBeenCalled()
  })

  it('fails closed before minting a link when completion changed to no-show', async () => {
    mocks.createServiceClient.mockReturnValue(service('no_show'))
    await expect(prepareBookingDelivery({
      ...row,
      event_type: 'booking_completed',
      payload: { ...row.payload, template: 'booking_completed' },
    })).resolves.toEqual({ ok: false, reason: 'booking_outcome_changed' })
    expect(mocks.createCustomerClaimLink).not.toHaveBeenCalled()
    expect(mocks.buildCancelToken).not.toHaveBeenCalled()
  })

  it('rejects an origin outside the tenant before building bearer links', async () => {
    await expect(prepareBookingDelivery({
      ...row,
      payload: { ...row.payload, origin: 'https://evil.example' },
    })).resolves.toEqual({ ok: false, reason: 'payload_invalid' })
    expect(mocks.createCustomerClaimLink).not.toHaveBeenCalled()
  })

  it('puts the freshly minted manage link in an admin rebooking email', async () => {
    const prepared = await prepareBookingDelivery({
      ...row,
      event_type: 'booking_rebooked',
      event_key: `booking:${row.booking_id}:rebooked:2030-01-02T10:00:00.000Z`,
      payload: {
        ...row.payload,
        template: 'booking_rebooked',
        include_account_claim: false,
      },
    })

    expect(prepared).toMatchObject({ ok: true, channel: 'email' })
    if (!prepared.ok || prepared.channel !== 'email') throw new Error('expected email')
    expect(prepared.html).toContain(
      '/avboka/20000000-0000-4000-8000-000000000001?t=cancel-secret',
    )
  })

  it('rechecks current marketing consent before preparing a completion delivery', async () => {
    const baseService = service('completed')
    mocks.createServiceClient.mockReturnValue({
      from(table: string) {
        if (table !== 'customer_notification_prefs') return baseService.from(table)
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: { marketing_consent: false, want_recommendations: false },
            error: null,
          }),
        }
        return query
      },
    })

    await expect(prepareBookingDelivery({
      ...row,
      event_type: 'booking_completed',
      event_key: `booking:${row.booking_id}:completed`,
      payload: {
        ...row.payload,
        template: 'booking_completed',
        include_manage_link: false,
        include_account_claim: false,
      },
    })).resolves.toEqual({ ok: false, reason: 'consent_denied' })
    expect(mocks.createCustomerClaimLink).not.toHaveBeenCalled()
    expect(mocks.buildCancelToken).not.toHaveBeenCalled()
  })
})
