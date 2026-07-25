import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0133_user_role_read_recursion.sql'),
  'utf8',
).toLowerCase()
const runtime = readFileSync(
  resolve(process.cwd(), '../../supabase/tests/user_role_read_recursion_0133_test.sql'),
  'utf8',
).toLowerCase()

describe('0133 user/role RLS recursion fix', () => {
  it('moves assigned-role checks behind one hardened helper', () => {
    expect(migration).toContain('create or replace function private.tenant_role_in_range(')
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('from public.roles r')
    expect(migration).toContain('r.id = p_role')
    expect(migration).toContain('r.tenant_id = p_tenant')
    expect(migration).toContain('r.level between p_min_level and p_max_level')
    expect(migration).toMatch(
      /revoke all on function private\.tenant_role_in_range\(uuid, uuid, integer, integer\)\s+from public, anon, authenticated, service_role/,
    )
    expect(migration).toMatch(
      /grant execute on function private\.tenant_role_in_range\(uuid, uuid, integer, integer\)\s+to authenticated/,
    )
  })

  it('keeps platform, owner and partner gates without raw role-policy reads', () => {
    expect(migration).toContain('drop policy if exists users_admin_insert on public.users')
    expect(migration).toContain('create policy users_admin_insert on public.users')
    expect(migration).toContain('(select private.is_platform_admin())')
    expect(migration).toMatch(
      /tenant_id = \(select private\.tenant_id\(\)\)\s+and \(select private\.has_organization_scope\(\)\)/,
    )
    expect(migration).toContain(
      '(select private.tenant_role_in_range(role_id, users.tenant_id, 1, 6))',
    )
    expect(migration).toContain('(select private.partner_id()) is not null')
    expect(migration).toContain('(select private.can_access_tenant(tenant_id))')
    const policies = migration.slice(migration.indexOf('drop policy if exists users_admin_insert'))
    expect(policies).not.toMatch(/from public\.roles/)
  })

  it('allows only the scoped global operator to confirm opening hours', () => {
    expect(migration).toContain(
      'create or replace function private.enforce_location_resource_fence()',
    )
    expect(migration).toContain('(select private.can_access_tenant(new.tenant_id))')
    expect(migration).toContain('new.confirmed_by = (select auth.uid())')
    expect(migration).toContain('u.tenant_id = new.tenant_id')
    expect(migration).toContain('invalid_opening_hours_confirmer')
  })

  it('keeps a rollback-safe authenticated owner-profile insert proof', () => {
    expect(runtime.trim()).toMatch(
      /^do \$goal84_user_role_rls\$[\s\S]*\$goal84_user_role_rls\$;$/,
    )
    expect(runtime).toContain("execute 'set local role authenticated'")
    expect(runtime).toContain('insert into public.users')
    expect(runtime).toContain('primary_location_id')
    expect(runtime).toContain('public.save_location_booking_settings(')
    expect(runtime).toContain('loh.confirmed_by = v_platform')
    expect(runtime).toContain('goal84_user_role_rls_insert_failed')
    expect(runtime).toContain("execute 'reset role'")
    expect(runtime).toContain('delete from auth.users')
    expect(runtime).toContain('delete from public.tenants')
  })
})
