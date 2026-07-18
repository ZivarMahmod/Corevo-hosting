import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const migration = path.resolve(
  WEB_ROOT,
  '..',
  '..',
  'supabase',
  'migrations',
  '0115_partner_tenant_scope.sql',
)

describe('0115 partner tenant scope migration', () => {
  it('keeps user role changes behind a scoped, audited RPC', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).not.toMatch(/'user_location_access',\s*'users'/)
    expect(sql).toContain('revoke update on table public.users from authenticated')
    expect(sql).toContain('grant update (phone) on table public.users to authenticated')
    expect(sql).toContain('create or replace function public.partner_update_tenant_user(')
    expect(sql).toContain('private.can_access_tenant(p_tenant)')
    expect(sql).toContain("'partner.user_update'")
  })

  it('backfills staff roles and limits partner role creation to fixed provisioning roles', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).toContain("select t.id, 'staff', 3")
    expect(sql).toContain('create policy roles_partner_provisioning_insert')
    expect(sql).toContain("t.status = 'provisioning'")
    expect(sql).toContain('level = 6')
    expect(sql).toContain("name = 'salon_admin'")
    expect(sql).toContain('level = 3')
    expect(sql).toContain("name = 'staff'")
  })

  it('routes tenant billing through a bounded, audited scope RPC', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).toContain('create or replace function public.platform_save_tenant_billing(')
    expect(sql).toContain('private.can_access_tenant(p_tenant)')
    expect(sql).toContain('p_setup_fee_cents not between 0 and 100000000')
    expect(sql).toContain("'tenant.billing'")
    expect(sql).toContain("current_user in ('postgres', 'service_role')")
  })

  it('keeps PII, domain routing and hardened intake tables out of broad partner DML', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    const loopStart = sql.indexOf('foreach v_table')
    const broadLoop = sql.slice(loopStart, sql.indexOf('] loop', loopStart) + 6)
    for (const table of [
      'customers',
      'tenant_domains',
      'contact_messages',
      'event_registrations',
      'offert_requests',
      'location_opening_hours',
      'time_off',
      'shop_orders',
      'staff',
      'staff_services',
      'working_hours',
      'user_location_access',
    ]) {
      expect(broadLoop, table).not.toContain(`'${table}'`)
    }
    expect(sql).toContain('create or replace function public.platform_customer_safe_rows(')
    expect(sql).toContain('create or replace function public.platform_create_customer(')
    expect(sql).toContain('create or replace function public.platform_set_contact_message_status(')
    expect(sql).toContain('create policy shop_orders_partner_update')
  })

  it('keeps staff replacements atomic and location access replace-only', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).toContain('create policy staff_partner_update')
    expect(sql).toContain('v_partner uuid := (select private.partner_id())')
    expect(sql).toContain('create or replace function public.platform_replace_staff_services(')
    expect(sql).toContain('create or replace function public.platform_replace_service_staff(')
    expect(sql).toContain('create or replace function public.platform_replace_staff_schedule(')
    expect(sql).toContain('create policy user_location_access_partner_insert')
    expect(sql).toContain('create policy user_location_access_partner_delete')
    expect(sql).toContain('revoke update on table public.user_location_access from authenticated')
  })

  it('protects machine-owned inventory counters from direct operator writes', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).toContain('create or replace function private.guard_partner_inventory_counters()')
    expect(sql).toContain('trg_shop_variant_reserved_guard')
    expect(sql).toContain('trg_shop_variant_delete_guard')
    expect(sql).toContain('trg_tenant_event_reserved_guard')
    expect(sql).toContain('trg_tenant_event_delete_guard')
    expect(sql).toContain('inventory_has_active_order_hold')
  })

  it('keeps rows bound to their original tenant inside a multi-tenant partner scope', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).toContain('create or replace function private.guard_partner_tenant_reassignment()')
    expect(sql).toContain('partner_tenant_reassignment_forbidden')
    expect(sql).toContain('create trigger trg_partner_tenant_immutable before update of tenant_id')
    expect(sql).toContain("'locations'")
    expect(sql).toContain("'services'")
    expect(sql).toContain("'tenant_settings'")
  })

  it('normalizes direct partner tenant inserts to safe provisioning defaults', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).toContain('create or replace function private.guard_partner_tenant_insert()')
    expect(sql).toContain("new.plan := 'standard'")
    expect(sql).toContain("new.status := 'provisioning'")
    expect(sql).toContain('new.id := gen_random_uuid()')
    expect(sql).toContain('new.stripe_account_id := null')
    expect(sql).toContain('create trigger trg_partner_tenant_insert_guard')
  })

  it('fences shop variants and image assets to their owning tenant', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).toContain('create or replace function private.guard_shop_catalog_tenant_refs()')
    expect(sql).toContain('shop_variant_product_tenant_mismatch')
    expect(sql).toContain('shop_image_asset_tenant_mismatch')
    expect(sql).toContain('trg_shop_variant_tenant_refs')
    expect(sql).toContain('trg_shop_product_tenant_refs')
  })

  it('does not expose raw notification, push or hold secrets to partners', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    const readLoopStart = sql.indexOf('-- Ledgers, delivery data')
    const readLoopEnd = sql.indexOf('] loop', readLoopStart)
    const readLoop = sql.slice(readLoopStart, readLoopEnd)
    expect(readLoop).not.toContain("'notifications_outbox'")
    expect(readLoop).not.toContain("'push_subscriptions'")
    expect(readLoop).not.toContain("'slot_holds'")
    expect(sql).toContain('drop policy if exists partner_scope_read on public.notifications_outbox')
    expect(sql).toContain('drop policy if exists partner_scope_read on public.push_subscriptions')
    expect(sql).toContain('drop policy if exists partner_scope_read on public.slot_holds')
  })

  it('adds DB-enforced partner policies across tenant data without broadening godmode', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).toContain('private.can_access_tenant(tenant_id)')
    expect(sql).toContain("'customers'")
    expect(sql).toContain("'staff'")
    expect(sql).toContain("'tenant_settings'")
    expect(sql).not.toMatch(/create or replace function private\.is_platform_admin[\s\S]*partner_id/)
  })

  it('makes platform communication RPCs partner-aware while keeping cron root-only', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).not.toContain('pg_catalog.coalesce')
    expect(sql).toContain('create or replace function public.platform_outbox_rows')
    expect(sql).toContain('create or replace function public.platform_outbox_summary')
    expect(sql).toContain('create or replace function public.platform_drift_health')
    expect(sql).toContain('v_partner uuid := (select private.partner_id())')
    expect(sql).not.toContain('create or replace function public.platform_cron_health')
  })

  it('routes site revision authorization through the same tenant scope helper', () => {
    const sql = fs.readFileSync(migration, 'utf8')
    expect(sql).toContain('create or replace function private.assert_site_revision_access')
    expect(sql).toContain('(select private.can_access_tenant(p_tenant))')
  })
})
