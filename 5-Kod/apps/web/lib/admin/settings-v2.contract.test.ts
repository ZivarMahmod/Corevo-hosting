import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/0081_tenant_member_permissions.sql'),
  'utf8',
).replaceAll('\r\n', '\n').toLowerCase()

describe('Inställningar v2 säkerhetskontrakt', () => {
  it('lagrar individuella personalrättigheter tenantbundet och fail-closed', () => {
    expect(sql).toContain('create table if not exists public.tenant_member_permissions')
    expect(sql).toContain('tenant_id uuid not null')
    expect(sql).toContain('staff_id uuid not null')
    expect(sql).toContain('unique (tenant_id, staff_id)')
    expect(sql).toContain('private.tenant_id()')
    expect(sql).toContain('auth.uid()')
    expect(sql).toContain("security definer\nset search_path = ''")
    expect(sql).toContain(
      'revoke all on function private.has_admin_area_permission(text) from public',
    )
    expect(sql).toContain('revoke all on table public.tenant_member_permissions from anon')
    expect(sql).toContain('grant select on table public.tenant_member_permissions to authenticated')
  })
})
