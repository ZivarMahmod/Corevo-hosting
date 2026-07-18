import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  import.meta.dirname,
  '../../../../supabase/migrations/0114_partner_foundation.sql',
)
const runtimePath = resolve(
  import.meta.dirname,
  '../../../../supabase/tests/partner_scope_0114_test.sql',
)

describe('partner foundation migration', () => {
  it('freezes outbox cost ownership at enqueue time', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('add column if not exists partner_id uuid references public.partners')
    expect(sql).toContain('create or replace function private.capture_outbox_partner()')
    expect(sql).toContain("raise exception 'outbox_cost_owner_is_immutable'")
  })

  it('qualifies active tenants at departure and freezes closed months in DB', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain("old.status = 'active'")
    expect(sql).toContain('old.partner_id is distinct from new.partner_id')
    expect(sql).toContain('create or replace function private.guard_closed_partner_license_month()')
    expect(sql).toContain("raise exception 'closed_partner_license_month_is_immutable'")
  })

  it('creates an isolated partner identity above tenants', () => {
    expect(existsSync(migrationPath), 'migration 0114 is missing').toBe(true)
    if (!existsSync(migrationPath)) return

    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('create table public.partners')
    expect(sql).toContain('create table public.partner_members')
    expect(sql).toContain('add column if not exists partner_id uuid')
    expect(sql).toContain('create or replace function private.partner_id()')
    expect(sql).toContain('create or replace function private.can_access_tenant(p_tenant uuid)')
    expect(sql).toContain('create or replace function private.has_platform_access()')
    expect(sql).toContain('private.is_platform_admin()')
    expect(sql).toContain('t.partner_id = (select private.partner_id())')
    expect(sql).toContain("r.name = 'partner_admin'")
    expect(sql).toContain("r.name = 'super_admin'")
    expect(sql).toContain('r.level = 8')
    expect(sql).not.toContain('r.level >= 8')
    expect(sql).toContain("pm.status = 'active'")
    expect(sql).toContain('alter table public.partners enable row level security')
    expect(sql).toContain('alter table public.partner_members enable row level security')
    expect(sql).toContain('revoke all on function private.partner_id() from public')
    expect(sql).toContain('grant execute on function private.partner_id() to authenticated')
  })

  it('uses an editable per-partner price and snapshots qualified months', () => {
    expect(existsSync(migrationPath), 'migration 0114 is missing').toBe(true)
    if (!existsSync(migrationPath)) return

    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('license_price_ore integer not null')
    expect(sql).toContain("status text not null default 'provisioning'")
    expect(sql).toMatch(/check \(license_price_ore between 0 and 100000000\)/)
    expect(sql).toContain('create table public.partner_license_months')
    expect(sql).toContain('unit_price_ore integer not null')
    expect(sql).toContain('primary key (partner_id, tenant_id, month)')
    expect(sql).toContain('create or replace function private.capture_partner_license_month()')
    expect(sql).toContain("new.status = 'active'")
    expect(sql).toContain("date_trunc('month', p_at at time zone p.timezone)::date")
    expect(sql).toContain('create or replace function private.sync_current_partner_license_price()')
    expect(sql).toContain('unit_price_ore = new.license_price_ore')
    expect(sql).toContain("old.status = 'provisioning' and new.status = 'active'")
    expect(sql).toContain('create or replace function public.refresh_partner_license_month(')
    expect(sql).toContain('on conflict (partner_id, tenant_id, month) do nothing')
    expect(sql).toContain('on delete restrict')
    expect(sql).not.toContain('tenants_partner_delete')
    expect(sql).toContain("status = 'provisioning'")
    expect(sql).toContain('tenants_partner_provisioning_delete')
    expect(sql).toContain("'5 * * * *'")
  })

  it('stores provider credentials in Vault and exposes only secret references', () => {
    expect(existsSync(migrationPath), 'migration 0114 is missing').toBe(true)
    if (!existsSync(migrationPath)) return

    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('create table public.partner_sms_configs')
    expect(sql).toContain('username_secret_id uuid')
    expect(sql).toContain('password_secret_id uuid')
    expect(sql).toContain('callback_secret_id uuid')
    expect(sql).toContain('vault.create_secret')
    expect(sql).toContain('vault.update_secret')
    expect(sql).toContain('vault.decrypted_secrets')
    expect(sql).toContain("nullif(btrim(p_username), '') is null and v_row.username_secret_id is null")
    expect(sql).toContain("nullif(p_password, '') is null and v_row.password_secret_id is null")
    expect(sql).toContain('to service_role')
    expect(sql).toContain("then 'partner-' || t.partner_id::text")
    expect(sql).toContain('create or replace function public.resolve_partner_sms_callback')
    expect(sql).toContain('o.partner_id = p_partner')
    expect(sql).toContain('v_row.callback_secret_id is null')
    expect(sql).toContain('sms_provider_change_current_month_locked')
    expect(sql).toContain('cost_currency')
    const publicConfigTable = sql.match(
      /create table public\.partner_sms_configs \([\s\S]*?\n\);/,
    )?.[0]
    expect(publicConfigTable).toBeTruthy()
    expect(publicConfigTable).not.toMatch(
      /\b(username|password|api_key|callback_secret)\s+text\b/i,
    )
  })

  it('ships rollback-safe runtime isolation proof', () => {
    expect(existsSync(runtimePath), '0114 runtime test is missing').toBe(true)
    if (!existsSync(runtimePath)) return

    const sql = readFileSync(runtimePath, 'utf8')
    expect(sql).toContain('begin;')
    expect(sql).toContain('rollback;')
    expect(sql).toContain('partner_cross_tenant_leak')
    expect(sql).toContain('global_platform_scope_failed')
    expect(sql).toContain('partner_license_price_refresh_failed')
    expect(sql).toContain('partner_license_history_rewritten')
    expect(sql).toContain('level_seven_global_bypass')
    expect(sql).toContain('partner_license_history_deleted')
    expect(sql).toContain('partner_negative_timezone_month_failed')
    expect(sql).toContain('partner_secret_plaintext_exposed')
    expect(sql).toContain('partner_summary_scope_failed')
    expect(sql).toContain('global_partner_summary_failed')
  })
})
