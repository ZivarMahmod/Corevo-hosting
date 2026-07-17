import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const actions = readFileSync(resolve(import.meta.dirname, '../../app/butik/actions.ts'), 'utf8').replaceAll(
  '\r\n',
  '\n',
)

describe('webshop payment persistence', () => {
  it('does not create a Stripe session when the payment row cannot be persisted', () => {
    expect(actions).toContain('const { error: stripePaymentError } = await admin.from(\'payments\').upsert(')
    expect(actions).toContain('if (stripePaymentError)')
  })

  it('does not create a PayPal order when the payment row cannot be persisted', () => {
    expect(actions).toContain('const { error: paypalPaymentError } = await admin.from(\'payments\').upsert(')
    expect(actions).toContain('if (paypalPaymentError)')
  })

  it('does not report Stripe checkout success when its session id cannot be persisted', () => {
    expect(actions).toContain('const { error: stripeSessionError } = await admin')
    expect(actions).toContain('if (stripeSessionError)')
  })
})
