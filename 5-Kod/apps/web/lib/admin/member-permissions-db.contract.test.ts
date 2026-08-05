import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0081_tenant_member_permissions.sql'),
  'utf8',
).toLowerCase()
const cleanup = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0082_tenant_member_permissions_cleanup.sql'),
  'utf8',
).toLowerCase()
const ownerFence = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/0083_tenant_member_permissions_owner_fence.sql',
  ),
  'utf8',
).toLowerCase()
const lifecyclePath = resolve(
  process.cwd(),
  '../../supabase/migrations/0130_tenant_mutation_lifecycle.sql',
)
const lifecycle = existsSync(lifecyclePath) ? readFileSync(lifecyclePath, 'utf8').toLowerCase() : ''
const lifecycleRuntimePath = resolve(
  process.cwd(),
  '../../supabase/tests/tenant_mutation_lifecycle_0130_test.sql',
)
const lifecycleRuntime = existsSync(lifecycleRuntimePath)
  ? readFileSync(lifecycleRuntimePath, 'utf8').toLowerCase()
  : ''

describe('tenant member permission database enforcement', () => {
  it('binds manager schedule writes to an accessible location', () => {
    expect(migration).toContain('create or replace function private.require_location_admin')
    expect(migration).toContain("private.has_admin_area_permission('scheman')")
    expect(migration).toContain('private.can_access_location(p_location)')
    expect(migration).toContain('create policy working_hours_manager_write')
    expect(migration).toContain('create policy working_hour_slots_manager_write')
  })

  it('keeps staff administration owner-only below security-definer RPCs', () => {
    expect(migration).toContain(
      'create or replace function private.guard_staff_management_permission',
    )
    expect(migration).toContain('private.is_location_admin(v_new_location)')
    expect(migration).toContain('create trigger trg_staff_management_permission')
    expect(migration).toContain("request.jwt.claims', true)::jsonb ->> 'role'")
    expect(migration).toContain("session_user in ('postgres', 'supabase_admin')")
    expect(migration).toContain('private.has_organization_scope()')
    expect(migration).toContain('v_old_tenant = v_session_tenant')
  })

  it('uses the explicit site grant for tenant-bound revisions', () => {
    expect(migration).toContain('create policy site_revisions_read')
    expect(migration).toContain("private.has_admin_area_permission('sida')")
    expect(migration).toContain('create or replace function private.assert_site_revision_access')
  })

  it('keeps SECURITY DEFINER tenant mutations active-only without removing operator scope', () => {
    expect(existsSync(lifecyclePath)).toBe(true)
    expect(lifecycle).toContain('create or replace function private.assert_active_tenant_mutation')
    expect(lifecycle).toContain("t.status = 'active'")
    expect(lifecycle).toContain('private.can_access_tenant(p_tenant)')
    expect(lifecycle).toContain('create or replace function private.require_location_admin')
    expect(lifecycle).toContain('create or replace function private.require_tenant_owner')
    expect(lifecycle).toContain('create or replace function private.assert_site_revision_access')
    expect(lifecycle).toContain("private.has_admin_area_permission('sida')")
    for (const fn of [
      'set_my_primary_location',
      'seed_explicit_slots_from_hours',
      'set_tenant_member_permissions',
      'set_my_notification_preferences',
      'create_my_time_off',
      'delete_my_time_off',
      'create_staff_walk_in',
      'atomic_erase_tenant_customer',
      'platform_set_contact_message_status',
    ]) {
      expect(lifecycle).toContain(`create or replace function public.${fn}`)
    }
    expect(lifecycle).toContain('perform private.assert_tenant_status_active(p_tenant)')
  })

  it('bypasses lifecycle checks for maintenance sessions only when no JWT role is present', () => {
    const start = lifecycle.indexOf(
      'create or replace function private.assert_active_tenant_mutation',
    )
    expect(start).toBeGreaterThanOrEqual(0)
    const body = lifecycle.slice(start, lifecycle.indexOf('$$;', start))

    expect(body).toMatch(
      /session_user in \('postgres', 'supabase_admin'\)\s+and coalesce\(\(select auth\.role\(\)\), ''\) = ''/,
    )
    expect(body.indexOf('perform private.assert_tenant_status_active(p_tenant)')).toBeLessThan(
      body.indexOf("(select auth.role()) = 'service_role'"),
    )
    expect(existsSync(lifecycleRuntimePath)).toBe(true)
    expect(lifecycleRuntime).toContain('set local role authenticated')
    expect(lifecycleRuntime).toContain("coalesce((select auth.role()), '') <> 'authenticated'")
  })

  it('keeps the two absence-impact readers status-neutral', () => {
    expect(lifecycle).toContain('create or replace function private.require_location_admin_read')
    for (const fn of ['preview_admin_time_off_impacts', 'get_admin_time_off_impacts']) {
      const start = lifecycle.indexOf(`create or replace function public.${fn}`)
      expect(start).toBeGreaterThanOrEqual(0)
      const body = lifecycle.slice(start, lifecycle.indexOf('$$;', start))
      expect(body).toContain('private.require_location_admin_read')
      expect(body).not.toContain('private.require_location_admin(')
    }
  })

  it('removes redundant advisor findings without widening grants', () => {
    expect(cleanup).toContain('drop policy if exists tenant_member_permissions_owner_write')
    expect(cleanup).toContain('drop index if exists public.tenant_member_permissions_tenant_idx')
    expect(migration).toContain(
      'revoke insert, update, delete on table public.tenant_member_permissions',
    )
  })

  it('reserverar tenantvida rolländringar och listläsning för organisationsägaren', () => {
    expect(ownerFence).toContain('create policy tenant_member_permissions_read')
    expect(ownerFence).toContain('private.has_organization_scope()')
    expect(ownerFence).toContain('create or replace function public.set_tenant_member_permissions')
    expect(ownerFence).toContain("raise exception 'organization_owner_required'")
    expect(ownerFence).toContain('s.id = p_staff')
    expect(ownerFence).toContain('s.tenant_id = v_tenant')
  })
})
