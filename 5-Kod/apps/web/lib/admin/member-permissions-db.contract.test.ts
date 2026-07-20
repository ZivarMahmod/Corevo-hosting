import { readFileSync } from 'node:fs'
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
  resolve(process.cwd(), '../../supabase/migrations/0083_tenant_member_permissions_owner_fence.sql'),
  'utf8',
).toLowerCase()
const actions = readFileSync(resolve(process.cwd(), 'lib/admin/actions.ts'), 'utf8')
const schedulePage = readFileSync(
  resolve(process.cwd(), 'app/(admin)/admin/scheman/page.tsx'),
  'utf8',
)
const staffDetailPage = readFileSync(
  resolve(process.cwd(), 'app/(admin)/admin/personal/[id]/page.tsx'),
  'utf8',
)
const staffDetail = readFileSync(
  resolve(process.cwd(), 'components/admin/StaffDetail.tsx'),
  'utf8',
)
const permissionLoader = readFileSync(
  resolve(process.cwd(), 'lib/admin/member-permissions.ts'),
  'utf8',
)

describe('tenant member permission database enforcement', () => {
  it('binds manager schedule writes to an accessible location', () => {
    expect(migration).toContain('create or replace function private.require_location_admin')
    expect(migration).toContain("private.has_admin_area_permission('scheman')")
    expect(migration).toContain('private.can_access_location(p_location)')
    expect(migration).toContain('create policy working_hours_manager_write')
    expect(migration).toContain('create policy working_hour_slots_manager_write')
    for (const fn of [
      'addStaffWorkingHours',
      'deleteStaffWorkingHours',
      'addStaffSlots',
      'deleteStaffSlot',
      'seedStaffSlots',
    ]) {
      const body = actions.slice(actions.indexOf(`export async function ${fn}`))
      expect(body.slice(0, body.indexOf('\n}'))).toContain("adminCtx('scheman')")
    }
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
    expect(schedulePage).not.toContain('<StaffBookability')
    expect(staffDetailPage).toContain(
      "const canManageRoles = canAccessPersonal && preferences.accessScope === 'organization'",
    )
    expect(staffDetailPage).toContain('const canManageStaff = canAccessPersonal &&')
    expect(staffDetail).toContain('canManageRoles ? (')
    expect(staffDetail).toContain('canManageStaff ? (')
    expect(staffDetail).toContain('<StaffBookability')
    expect(staffDetail).toContain('<DangerSection')
  })

  it('uses the explicit site grant for tenant-bound revisions', () => {
    expect(migration).toContain('create policy site_revisions_read')
    expect(migration).toContain("private.has_admin_area_permission('sida')")
    expect(migration).toContain('create or replace function private.assert_site_revision_access')
  })

  it('removes redundant advisor findings without widening grants', () => {
    expect(cleanup).toContain('drop policy if exists tenant_member_permissions_owner_write')
    expect(cleanup).toContain('drop index if exists public.tenant_member_permissions_tenant_idx')
    expect(migration).toContain('revoke insert, update, delete on table public.tenant_member_permissions')
  })

  it('reserverar tenantvida rolländringar och listläsning för organisationsägaren', () => {
    expect(ownerFence).toContain('create policy tenant_member_permissions_read')
    expect(ownerFence).toContain('private.has_organization_scope()')
    expect(ownerFence).toContain('create or replace function public.set_tenant_member_permissions')
    expect(ownerFence).toContain("raise exception 'organization_owner_required'")
    expect(ownerFence).toContain('s.id = p_staff')
    expect(ownerFence).toContain('s.tenant_id = v_tenant')
    expect(permissionLoader).toContain("if (error) throw new Error('member_permissions_load_failed')")
  })
})
