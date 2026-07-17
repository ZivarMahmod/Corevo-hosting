import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/0085_protect_payment_commit_rpcs.sql'),
  'utf8',
).toLowerCase()
const refundMigration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/0087_record_shop_order_refund.sql'),
  'utf8',
).toLowerCase()

describe('payment commit RPC grants', () => {
  for (const fn of ['mark_shop_order_paid(uuid)', '_commit_shop_order_stock(uuid)']) {
    it(`keeps ${fn} server-only`, () => {
      expect(migration).toContain(`revoke all on function public.${fn} from public`)
      expect(migration).toContain(`revoke all on function public.${fn} from anon`)
      expect(migration).toContain(`revoke all on function public.${fn} from authenticated`)
      expect(migration).toContain(`grant execute on function public.${fn} to service_role`)
    })
  }

  for (const fn of [
    '_generate_gift_code(uuid,text)',
    'prune_expired_shop_reserves()',
    'check_rate_limit(text,int,int)',
  ]) {
    it(`keeps internal RPC ${fn} server-only`, () => {
      expect(migration).toContain(`revoke all on function public.${fn} from public`)
      expect(migration).toContain(`revoke all on function public.${fn} from anon`)
      expect(migration).toContain(`revoke all on function public.${fn} from authenticated`)
      expect(migration).toContain(`grant execute on function public.${fn} to service_role`)
    })
  }

  it('records external refunds atomically through a server-only RPC', () => {
    expect(refundMigration).toContain('update public.payments')
    expect(refundMigration).toContain('update public.shop_orders')
    expect(refundMigration).toContain(
      'from public, anon, authenticated',
    )
    expect(refundMigration).toContain(
      'grant execute on function public.record_shop_order_refund(uuid) to service_role',
    )
  })
})
