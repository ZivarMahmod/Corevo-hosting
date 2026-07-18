import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0097_sms_delivery_gate.sql'),
  'utf8',
)

describe('0097 SMS delivery DB contract', () => {
  it('har unik providerreferens och en service-role-only RPC med låst search_path', () => {
    expect(migration).toContain('notifications_outbox_sms_provider_ref_unique')
    expect(migration).toContain('create or replace function public.record_sms_delivery')
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('to service_role')
  })

  it('begränsar provider-id, statusar och monotona terminala övergångar', () => {
    expect(migration).toContain("p_status not in ('sent', 'delivered', 'failed')")
    expect(migration).toContain("v_current in ('delivered', 'failed')")
    expect(migration).toContain("when p_status = 'delivered'")
    expect(migration).toContain("when p_status = 'failed'")
    expect(migration).toContain("'unknown_provider'")
    expect(migration).toContain("'idempotent'")
  })
})
