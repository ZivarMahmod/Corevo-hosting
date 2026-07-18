import { describe, expect, it } from 'vitest'
import { commerceReleaseGate } from './commerce'

const TENANT = '11111111-1111-4111-8111-111111111111'

describe('commerceReleaseGate', () => {
  it('fails closed when no release decision exists', () => {
    expect(commerceReleaseGate(TENANT, {})).toEqual({
      shop: false,
      presentkort: false,
      paypal: false,
      bookingPayment: false,
    })
  })

  it('does not release commerce from an acknowledgement or tenant allowlist alone', () => {
    expect(
      commerceReleaseGate(TENANT, {
        COREVO_COMMERCE_RELEASE: 'settlement-v1-verified',
      }).shop,
    ).toBe(false)
    expect(
      commerceReleaseGate(TENANT, {
        COREVO_COMMERCE_TENANT_IDS: TENANT,
      }).shop,
    ).toBe(false)
  })

  it('releases shop and presentkort only for an exactly allowlisted tenant after settlement acceptance', () => {
    const env = {
      COREVO_COMMERCE_RELEASE: 'settlement-v1-verified',
      COREVO_COMMERCE_TENANT_IDS: `other, ${TENANT.toUpperCase()} `,
    }
    expect(commerceReleaseGate(TENANT, env)).toMatchObject({ shop: true, presentkort: true })
    expect(commerceReleaseGate('22222222-2222-4222-8222-222222222222', env).shop).toBe(false)
  })

  it('keeps PayPal behind its own reviewed rail in addition to the commerce gate', () => {
    const base = {
      COREVO_COMMERCE_RELEASE: 'settlement-v1-verified',
      COREVO_COMMERCE_TENANT_IDS: TENANT,
      COREVO_PAYPAL_TENANT_IDS: TENANT,
    }
    expect(commerceReleaseGate(TENANT, base).paypal).toBe(false)
    expect(
      commerceReleaseGate(TENANT, {
        ...base,
        COREVO_PAYPAL_RELEASE: 'partner-v1-reviewed',
      }).paypal,
    ).toBe(true)
  })

  it('keeps booking payment independent and double-gated', () => {
    expect(
      commerceReleaseGate(TENANT, {
        COREVO_BOOKING_PAYMENT_RELEASE: 'settlement-v1-verified',
        COREVO_BOOKING_PAYMENT_TENANT_IDS: TENANT,
      }).bookingPayment,
    ).toBe(true)
    expect(
      commerceReleaseGate(TENANT, {
        COREVO_BOOKING_PAYMENT_RELEASE: 'settlement-v1-verified',
      }).bookingPayment,
    ).toBe(false)
  })

  it('rejects near-miss release acknowledgements', () => {
    expect(
      commerceReleaseGate(TENANT, {
        COREVO_COMMERCE_RELEASE: 'true',
        COREVO_COMMERCE_TENANT_IDS: TENANT,
        COREVO_BOOKING_PAYMENT_RELEASE: 'verified',
        COREVO_BOOKING_PAYMENT_TENANT_IDS: TENANT,
      }),
    ).toEqual({ shop: false, presentkort: false, paypal: false, bookingPayment: false })
  })
})
