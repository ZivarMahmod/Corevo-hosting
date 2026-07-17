import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/0088_atomic_reminder_claims.sql'),
  'utf8',
).toLowerCase()

describe('atomic reminder claims', () => {
  it('leases due rows under a row lock and exposes the claim only to service_role', () => {
    expect(sql).toContain('for update skip locked')
    expect(sql).toContain('reminder_claim_token = p_claim')
    expect(sql).toContain("interval '15 minutes'")
    expect(sql).toContain('from public, anon, authenticated')
    expect(sql).toContain('to service_role')
  })
})
