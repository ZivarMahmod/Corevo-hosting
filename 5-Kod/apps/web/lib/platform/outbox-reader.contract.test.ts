import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  import.meta.dirname,
  '../../../../supabase/migrations/0110_platform_outbox_rows.sql',
)
const runtimePath = resolve(
  import.meta.dirname,
  '../../../../supabase/tests/platform_outbox_rows_0110_test.sql',
)

describe('platform outbox reader migration', () => {
  it('adds a platform-gated, partner-ready filtered row reader', () => {
    expect(existsSync(migrationPath), 'migration 0110 is missing').toBe(true)
    if (!existsSync(migrationPath)) return

    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('create or replace function public.platform_outbox_rows(')
    expect(sql).toContain('p_tenant uuid default null')
    expect(sql).toContain('p_channel text default null')
    expect(sql).toContain('p_status text default null')
    expect(sql).toContain('p_category text default null')
    expect(sql).toContain('p_limit integer default 100')
    expect(sql).toContain('if not (select private.is_platform_admin()) then')
    expect(sql).toMatch(/p_limit is null[\s\S]*?p_limit not between 1 and 250/)
    expect(sql).toMatch(/o\.tenant_id = p_tenant/)
    expect(sql).toMatch(/o\.chosen_channel = p_channel/)
    expect(sql).toMatch(/o\.status = p_status/)
    expect(sql).toMatch(/o\.category = p_category/)
    expect(sql).toContain('o.provider_ref')
    expect(sql).toContain('limit p_limit')
    expect(sql).toContain('revoke all on function public.platform_outbox_rows(uuid, text, text, text, integer) from public, anon;')
    expect(sql).toContain('grant execute on function public.platform_outbox_rows(uuid, text, text, text, integer) to authenticated, service_role;')
    expect(sql).not.toContain("p_channel not in ('sms'")
    expect(sql).not.toContain('o.payload')
    expect(sql).not.toContain('o.customer_id')
  })

  it('ships a rollback-safe SQL runtime test for gate, grants, validation and filters', () => {
    expect(existsSync(runtimePath), '0110 runtime test is missing').toBe(true)
    if (!existsSync(runtimePath)) return

    const sql = readFileSync(runtimePath, 'utf8')
    expect(sql).toContain('begin;')
    expect(sql).toContain('rollback;')
    expect(sql).toContain('non_platform_outbox_rows_succeeded')
    expect(sql).toContain('platform_outbox_rows_limit_validation_missing')
    expect(sql).toContain('platform_outbox_rows_tenant_filter_failed')
    expect(sql).toContain('platform_outbox_rows_channel_filter_failed')
    expect(sql).toMatch(/has_function_privilege\(\s*'anon'/)
    expect(sql).toMatch(/has_function_privilege\(\s*'authenticated'/)
    expect(sql).toMatch(/has_function_privilege\(\s*'service_role'/)
  })
})
