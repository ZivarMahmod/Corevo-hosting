import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const paymentFenceMigration = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../supabase/migrations/20260802164000_shop_payment_access_fence.sql',
  ),
  'utf8',
).replaceAll('\r\n', '\n')
describe('webshop payment persistence', () => {
  it('keeps the database payment-method fence append-only', () => {
    expect(paymentFenceMigration).toContain(
      'create or replace function private.guard_shop_payment_method_required()',
    )
    expect(paymentFenceMigration).toContain("raise exception 'payment_method_required'")
    expect(paymentFenceMigration).toContain('create trigger trg_shop_payment_method_required')
  })
})
