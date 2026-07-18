import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../gdpr/erase.ts'),
  'utf8',
)
const migration = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/0099_atomic_tenant_customer_erase.sql',
  ),
  'utf8',
)

describe('outbox GDPR contract', () => {
  it('scrubs customer- and booking-linked outbox rows inside the atomic DB transaction', () => {
    const globalErase = source.slice(
      source.indexOf('export async function eraseCustomerData'),
      source.indexOf('export async function eraseTenantCustomerData'),
    )
    const tenantErase = source.slice(source.indexOf('export async function eraseTenantCustomerData'))

    expect(globalErase).toMatch(/rpc\(\s*'atomic_erase_self_customer_account'/)
    expect(tenantErase).toMatch(/rpc\(\s*'atomic_erase_tenant_customer'/)
    expect(migration).toContain('update public.notifications_outbox')
    expect(migration).toContain('o.booking_id = any(v_booking_ids)')
    expect(migration).toContain("then 'gdpr_erased'")
    expect(migration).toContain('lease_token = null')
    expect(migration).toContain("payload = '{}'::jsonb")
  })
})
