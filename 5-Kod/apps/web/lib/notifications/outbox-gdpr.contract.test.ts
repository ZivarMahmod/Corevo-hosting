import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/0099_atomic_tenant_customer_erase.sql',
  ),
  'utf8',
)

describe('outbox GDPR contract', () => {
  it('scrubs customer- and booking-linked outbox rows inside the atomic DB transaction', () => {
    expect(migration).toContain('update public.notifications_outbox')
    expect(migration).toContain('o.booking_id = any(v_booking_ids)')
    expect(migration).toContain("then 'gdpr_erased'")
    expect(migration).toContain('lease_token = null')
    expect(migration).toContain("payload = '{}'::jsonb")
  })
})
