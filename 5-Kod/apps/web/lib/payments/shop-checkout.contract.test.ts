import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const actions = readFileSync(resolve(import.meta.dirname, '../../app/butik/actions.ts'), 'utf8').replaceAll(
  '\r\n',
  '\n',
)
const checkoutHook = readFileSync(
  resolve(import.meta.dirname, '../../components/storefront/shop/useCheckout.ts'),
  'utf8',
).replaceAll('\r\n', '\n')
const paymentFenceMigration = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../supabase/migrations/20260802164000_shop_payment_access_fence.sql',
  ),
  'utf8',
).replaceAll('\r\n', '\n')
const checkoutPage = readFileSync(
  resolve(import.meta.dirname, '../../app/(public)/kassa/page.tsx'),
  'utf8',
).replaceAll('\r\n', '\n')

describe('webshop payment persistence', () => {
  it('prepares one DB-owned payment snapshot for Stripe', () => {
    expect(actions).toContain("admin.rpc('prepare_shop_order_payment'")
    expect(actions).not.toContain("admin.from('payments').upsert(")
    expect(actions).toContain("'stripe',\n    tenant.stripe_account_id")
  })

  it('prepares the same DB-owned payment snapshot for PayPal', () => {
    expect(actions).toContain("'paypal',\n    'paypal:platform'")
  })

  it('sends providers one exact total line and persists their order reference by RPC', () => {
    expect(actions).toContain("product_data: { name: 'Beställning' }")
    expect(actions).toContain("admin.rpc('record_shop_payment_order_reference'")
    expect(actions).not.toContain('shop_order_items(product_name,unit_price_cents,quantity)')
  })

  it('does not release the stock hold during a successful provider redirect', () => {
    expect(checkoutHook).toContain('if (orderId && token && !inFlight.current)')
    expect(checkoutHook).not.toContain('if (orderId && token && !submitting)')
  })

  it('passes the cart session token to both provider starts', () => {
    expect(checkoutHook).toContain('startPaypalCheckout(res.orderId, token)')
    expect(checkoutHook).toContain('startShopCheckout(res.orderId, token, paymentMethod)')
  })

  it('keeps the database payment-method fence append-only', () => {
    expect(paymentFenceMigration).toContain('create or replace function private.guard_shop_payment_method_required()')
    expect(paymentFenceMigration).toContain("raise exception 'payment_method_required'")
    expect(paymentFenceMigration).toContain('create trigger trg_shop_payment_method_required')
  })

  it('does not present configured but unavailable online payment as pay-on-pickup', () => {
    expect(checkoutPage).toContain('shop.config.paymentMethods.length > 0')
    expect(checkoutPage).toContain('checkout.paymentMethods.length === 0')
    expect(checkoutPage).toContain('Betalningen är tillfälligt stängd')
  })
})
