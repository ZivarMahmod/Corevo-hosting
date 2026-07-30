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
})
