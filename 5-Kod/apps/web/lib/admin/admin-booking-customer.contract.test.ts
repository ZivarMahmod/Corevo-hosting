import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const readCode = (relative: string) => fs.readFileSync(path.join(CODE_ROOT, relative), 'utf8')

describe('adminbokningens kundkoppling', () => {
  it('gör bokning, namn-only-kund och kundkoppling atomiskt bakom en admin- och tenantvakt', () => {
    const migration = readCode('supabase/migrations/0070_admin_booking_customer_link.sql')

    expect(migration).toContain('create or replace function public.create_admin_booking(')
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('coalesce(private.role_level(), 0) < 3')
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock')
    expect(migration).toContain("'created', false")
    expect(migration).toContain("'created', true")
    expect(migration).toContain('c.tenant_id = v_tenant')
    expect(migration).toContain('public.create_public_booking(')
    expect(migration).toContain('insert into public.customers')
    expect(migration).toMatch(
      /update public\.bookings[\s\S]*customer_id = v_customer_id[\s\S]*status = 'confirmed'/,
    )
    expect(migration).toContain('revoke execute on function public.create_admin_booking(')
    expect(migration).toContain('from public;')
    expect(migration).toContain('to authenticated;')
    expect(migration).not.toContain('to anon')
  })
})
