import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')
const migrationPath = path.join(
  CODE_ROOT,
  'supabase',
  'migrations',
  '0076_location_schedule_access_foundation.sql',
)

function migration() {
  return fs.readFileSync(migrationPath, 'utf8').toLowerCase()
}

describe('migration 0076 location and schedule foundation', () => {
  it('makes owner and location access explicit and fail closed', () => {
    const sql = migration()

    expect(sql).toContain("add column if not exists access_scope text")
    expect(sql).toContain("check (access_scope in ('organization', 'locations'))")
    expect(sql).toContain('add column if not exists primary_location_id uuid')
    expect(sql).toContain('create table if not exists public.user_location_access')
    expect(sql).toContain('tenant_id uuid not null')
    expect(sql).toContain('unique (user_id, location_id)')
    expect(sql).toContain('create or replace function private.has_organization_scope()')
    expect(sql).toContain('create or replace function private.can_access_location(p_location uuid)')
    expect(sql).toContain("u.access_scope = 'organization'")
    expect(sql).toContain("u.access_scope = 'locations'")
    expect(sql).toContain('create or replace function public.set_my_primary_location(p_location uuid)')
    expect(sql).toContain('revoke execute on function public.set_my_primary_location(uuid) from public, anon')
    expect(sql).toContain('v_access_scope_was_missing')
    expect(sql).not.toContain("when r.level >= 6 and u.access_scope = 'locations' then 5")
  })

  it('adds confirmed location hours, closures and structured time off', () => {
    const sql = migration()

    expect(sql).toContain('create table if not exists public.location_opening_hours')
    expect(sql).toContain("source text not null")
    expect(sql).toContain("check (source in ('confirmed', 'staff_union', 'default'))")
    expect(sql).toContain('confirmed_at timestamptz')
    expect(sql).toContain('confirmed_by uuid')
    expect(sql).toContain('create table if not exists public.location_closures')
    expect(sql).toContain('exclude using gist')
    expect(sql).toContain('add column if not exists kind text')
    expect(sql).toContain("check (kind in ('break', 'leave', 'sick', 'other'))")
    expect(sql).toContain('create or replace function public.save_location_booking_settings')
    expect(sql).toContain('new.confirmed_at := now()')
    expect(sql).toContain('new.confirmed_by := (select auth.uid())')
    expect(sql).toContain('new.created_by := (select auth.uid())')
  })

  it('imports interval islands without opening real schedule gaps', () => {
    const sql = migration()

    expect(sql).toContain('previous_max_end')
    expect(sql).toContain('island_id')
    expect(sql).not.toContain("min(wh.start_time), max(wh.end_time), 'staff_union'")
  })

  it('keeps only verified generated slot grids eligible for conversion', () => {
    const sql = migration()

    expect(sql).toContain('create table if not exists private.working_hour_slots_0076_snapshot')
    expect(sql).toContain("classification = 'full_resolved_grid'")
    expect(sql).not.toContain("classification = 'full_uniform_grid_review'")
    expect(sql).not.toContain("classification = 'irregular_special_review'")
  })

  it('fences services and customer notes by location', () => {
    const sql = migration()

    expect(sql).toContain('add column if not exists location_id uuid')
    expect(sql).toContain('create or replace function private.enforce_staff_service_fence()')
    expect(sql).toContain('svc.location_id is null')
    expect(sql).toContain('svc.location_id = s.location_id')
    expect(sql).toContain('create policy customer_notes_location_read')
    expect(sql).toContain('create policy customer_notes_location_write')
    expect(sql).toContain('create or replace function private.enforce_service_location_fence()')
    expect(sql).not.toContain('alter table public.customer_notes alter column location_id set not null')
    expect(sql).not.toContain('drop constraint if exists customer_notes_tenant_id_customer_id_key')
  })

  it('replaces permissive customer and booking policies with location fences', () => {
    const sql = migration()

    expect(sql).toContain('create or replace function private.can_access_customer(p_customer uuid)')
    expect(sql).toContain('drop policy if exists customers_role_read')
    expect(sql).toContain('drop policy if exists customers_staff_write')
    expect(sql).toContain('drop policy if exists bookings_role_read')
    expect(sql).toContain('drop policy if exists bookings_staff_insert')
    expect(sql).toContain('create policy bookings_location_read')
    expect(sql).toContain('create policy bookings_location_insert')
  })

  it('keeps new tables available to trusted server flows only', () => {
    const sql = migration()

    expect(sql).toContain('grant select, insert, update, delete on table public.location_opening_hours, public.location_closures to service_role')
    expect(sql).toContain('grant select, insert, update, delete on table public.user_location_access to service_role')
  })

  it('replaces every legacy level-six owner gate with organization scope', () => {
    const sql = migration()

    expect(sql).toContain('do $organization_policy_inventory$')
    expect(sql).toContain('drop policy if exists roles_scoped_read')
    expect(sql).toContain('drop policy if exists users_admin_insert')
    expect(sql).toContain('drop policy if exists tenants_admin_update')
    expect(sql).toContain('drop policy if exists tenant_modules_write')
    expect(sql).toContain('drop policy if exists slot_holds_admin_read')
    expect(sql).toContain('create policy slot_holds_scoped_read')
    expect(sql).toContain("to_regclass('public.slot_holds') is not null")
    expect(sql).toContain("'blog_posts', 'content_slots', 'media_assets'")
  })

  it('creates staff from confirmed location hours and matching services', () => {
    const sql = migration()

    expect(sql).toContain('create or replace function public.create_staff_with_defaults')
    expect(sql).toContain('from public.location_opening_hours loh')
    expect(sql).toContain('loh.confirmed_at is not null')
    expect(sql).toContain("(svc.location_id is null or svc.location_id = v_location)")
    expect(sql).toContain('coalesce(p_location, u.primary_location_id)')
    expect(sql).not.toContain('coalesce(p_location, u.primary_location_id, (')
  })

  it('cannot activate draft staff before location hours are confirmed', () => {
    const sql = migration()

    expect(sql).toContain('create or replace function public.set_staff_active')
    expect(sql).toContain("raise exception 'staff_activation_requires_confirmed_opening_hours'")
    expect(sql).toContain('loh.confirmed_at is not null')
  })
})
