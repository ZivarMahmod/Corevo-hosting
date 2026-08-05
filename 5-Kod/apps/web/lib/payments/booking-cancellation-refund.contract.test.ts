import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(process.cwd(), '../..')
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')

describe('booking cancellation refund consolidation', () => {
  it('queues a succeeded booking payment refund in the cancellation transaction', () => {
    const migration = read(
      'supabase/migrations/20260802100000_atomic_booking_cancellation_refunds.sql',
    )

    expect(migration).toContain(
      'create or replace function private.enqueue_booking_refund_on_cancel()',
    )
    expect(migration).toMatch(
      /old\.status is distinct from 'cancelled'[\s\S]*new\.status = 'cancelled'/,
    )
    expect(migration).toMatch(/from public\.payments[\s\S]*status = 'succeeded'[\s\S]*for update/)
    expect(migration).toContain('private.enqueue_booking_payment_refund(')
    expect(migration).toMatch(/after update of status[\s\S]*on public\.bookings/)
    expect(migration).toContain('revoke all on function private.enqueue_booking_refund_on_cancel()')
  })
})
