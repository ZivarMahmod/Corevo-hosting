import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')
const readMigration = (name: string) =>
  fs.readFileSync(path.join(CODE_ROOT, 'supabase', 'migrations', name), 'utf8')

describe('rollmedveten RLS för kundadmin', () => {
  it('stänger rolleskalering via users och roles men behåller egen telefonuppdatering', () => {
    const sql = readMigration('0071_role_aware_admin_rls.sql')

    expect(sql).toContain('drop policy if exists users_rls on public.users')
    expect(sql).toContain('drop policy if exists roles_write on public.roles')
    expect(sql).toContain('create policy users_self_update_phone')
    expect(sql).toContain('id = (select auth.uid())')
    expect(sql).toContain('revoke update on public.users from authenticated')
    expect(sql).toContain('grant update (phone) on public.users to authenticated')
    expect(sql).toContain('create policy roles_platform_write')
    expect(sql).toContain('create policy roles_scoped_read')
    expect(sql).toContain('(select private.is_platform_admin())')
    expect(sql).toContain('create or replace function private.tenant_id()')
    expect(sql).toContain('and r.tenant_id = u.tenant_id')
    expect(sql).toContain("amd := amd - 'tenant_id'")
    expect(sql).toContain('create or replace function private.role_level()')
    expect(sql).toContain("u.status = 'active'")
    expect(sql).toContain('s.active = true')
  })

  it('kräver ägarnivå för företagskonfiguration och privata moduldata', () => {
    const sql = readMigration('0071_role_aware_admin_rls.sql')

    for (const table of [
      'tenant_settings',
      'tenant_domains',
      'locations',
      'staff',
      'services',
      'staff_services',
      'working_hours',
      'working_hour_slots',
      'blog_posts',
      'shop_orders',
      'shop_order_items',
      'offert_requests',
      'gift_cards',
      'event_registrations',
    ]) {
      expect(sql).toContain(`drop policy if exists ${table}_rls on public.${table}`)
    }
    expect(sql).toContain('(select private.role_level()) >= 6')
    expect(sql).toContain('create policy admin_private_data_read')
    expect(sql).toContain('create policy admin_private_data_write')
    expect(sql).toContain('create policy shop_orders_owner_update')
    expect(sql).toContain('machine_owned_order_fields_are_read_only')
    expect(sql).toContain('create policy shop_order_items_platform_write')
    expect(sql).toContain('create policy payment_disputes_platform_write')
    expect(sql).toContain('create policy gift_cards_owner_insert')
    expect(sql).toContain('gift_card_machine_fields_are_read_only')
    expect(sql).toContain('create policy event_registrations_owner_update')
    expect(sql).toContain('registration_identity_is_read_only')
    expect(sql).toContain('create trigger trg_tenants_owner_guard')
    expect(sql).toContain('create trigger trg_tenant_settings_billing_guard')
    expect(sql).toContain('revoke select on table public.tenants from anon')
    expect(sql).toContain('revoke select on table public.tenant_settings from anon')
    expect(sql).toContain("to_regclass('public.slot_holds')")
    expect(sql).toContain('create policy tenant_settings_platform_delete')
    expect(sql).not.toMatch(/grant select \([\s\S]*setup_fee_cents[\s\S]*\) on public\.tenant_settings to anon/)
    expect(sql).toContain('new.payments_enabled is distinct from old.payments_enabled')
    expect(sql).toContain('new.per_booking_fee_cents is distinct from old.per_booking_fee_cents')
    expect(sql).toContain('new.service_fee_type is distinct from old.service_fee_type')
    expect(sql).toContain('create policy tenant_domains_platform_write')
    expect(sql).not.toContain('platform_fee_fixed_cents')
    expect(sql).not.toContain('platform_fee_bps')
    expect(sql).toContain("coalesce((select auth.role()), '') <> 'service_role'")
  })

  it('skriver Stripe-ägda fält via serverrollen i stället för ägarens webbsession', () => {
    const stripe = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'stripe.ts'), 'utf8')

    expect(stripe).toContain("import { createAdminServiceClient } from './service'")
    expect(stripe).toMatch(/service\s*\.from\('tenants'\)/)
    expect(stripe).toMatch(/service\s*\.from\('tenant_settings'\)/)
  })

  it('låter kunder läsa men inte direkt skriva bokningar eller betalningar', () => {
    const sql = readMigration('0071_role_aware_admin_rls.sql')

    expect(sql).toContain('drop policy if exists bookings_rls on public.bookings')
    expect(sql).toContain('drop policy if exists payments_rls on public.payments')
    expect(sql).toContain('create policy bookings_role_read')
    expect(sql).toContain('create policy bookings_staff_insert')
    expect(sql).not.toContain('create policy bookings_staff_write')
    expect(sql).toContain('drop policy if exists bookings_customer_cancel')
    expect(sql).not.toContain('create policy bookings_customer_cancel')
    expect(sql).toContain('create policy payments_role_read')
    expect(sql).not.toContain('create policy payments_role_write')
  })

  it('ersätter senare tenant-only-policies och stänger direkta slot-holds', () => {
    const sql = readMigration('0071_role_aware_admin_rls.sql')

    for (const policy of [
      'shop_shipping_options_tenant_all',
      'contact_messages_tenant_read',
      'contact_messages_tenant_write',
      'gallery_items_tenant_all',
      'loyalty_plans_tenant_all',
      'loyalty_members_tenant_all',
      'slot_holds_rls',
      'slot_holds_public_read',
      'slot_holds_public_write',
      'slot_holds_public_release',
    ]) {
      expect(sql).toContain(`drop policy if exists ${policy}`)
    }
    expect(sql).toContain('create policy loyalty_members_scoped_read')
    expect(sql).toContain('create policy slot_holds_admin_read')
  })

  it('låter bara verifierade serveractions uppdatera befintliga bokningar', () => {
    const actions = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'actions.ts'), 'utf8')
    const calendar = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'calendar-actions.ts'), 'utf8')
    const personal = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'personal', 'actions.ts'), 'utf8')

    expect(actions).toMatch(/createAdminServiceClient\(\)[\s\S]*?\.from\('bookings'\)[\s\S]*?\.update/)
    expect(calendar).toMatch(/createAdminServiceClient\(\)[\s\S]*?\.from\('bookings'\)[\s\S]*?\.update/)
    expect(personal).toMatch(/createAdminServiceClient\(\)/)
    expect(actions).toContain("status === 'no_show' || status === 'completed'")
    expect(personal).toContain("status === 'completed' || status === 'no_show'")
    expect(actions).toContain(".lte('start_ts', nowIso)")
    expect(personal).toContain(".lte('start_ts', nowIso)")
  })

  it('exponerar inte ägar-RPC:er för den publika anon-rollen', () => {
    const sql = readMigration('0074_admin_rpc_execute_fence.sql')

    for (const fn of [
      'create_admin_booking',
      'create_staff_with_defaults',
      'set_staff_active',
      'replace_staff_services',
      'restore_schedule_backup',
    ]) {
      expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${fn}[\\s\\S]*?from anon;`))
    }
  })
})
