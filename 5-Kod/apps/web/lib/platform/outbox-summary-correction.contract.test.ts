import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  import.meta.dirname,
  '../../../../supabase/migrations/0112_platform_outbox_summary_truth.sql',
)
const runtimePath = resolve(
  import.meta.dirname,
  '../../../../supabase/tests/platform_outbox_summary_0112_test.sql',
)
const ciPath = resolve(import.meta.dirname, '../../../../../.github/workflows/ci.yml')

describe('platform outbox summary correction', () => {
  it('replaces the deployed RPC with tenant-banded truthful aggregates and read indexes', () => {
    expect(existsSync(migrationPath), 'migration 0112 is missing').toBe(true)
    if (!existsSync(migrationPath)) return

    const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

    expect(sql).not.toContain('pg_catalog.coalesce')
    expect(sql).toContain('create index if not exists notifications_outbox_recent_idx')
    expect(sql).toContain('(created_at desc, id desc)')
    expect(sql).toContain('create index if not exists notifications_outbox_tenant_recent_idx')
    expect(sql).toContain('(tenant_id, created_at desc, id desc)')
    expect(sql).toContain('create or replace function public.platform_outbox_summary()')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('if not (select private.is_platform_admin()) then')
    expect(sql).toMatch(/where o\.created_at > pg_catalog\.now\(\) - interval '30 days'/)
    expect(sql).toMatch(/o\.status in \('sent', 'delivered'\)/)
    expect(sql).toMatch(/o\.chosen_channel = 'sms'[\s\S]*?o\.status <> 'simulated'/)
    expect(sql).toMatch(/where c\.status = 'active'/)
    expect(sql).toMatch(/pg_catalog\.count\(distinct c\.id\)/)
    expect(sql).toContain(
      'revoke all on function public.platform_outbox_summary() from public, anon;',
    )
    expect(sql).toContain(
      'grant execute on function public.platform_outbox_summary() to authenticated, service_role;',
    )
  })

  it('ships a rollback-safe runtime proof for truth, adoption, gate and grants', () => {
    expect(existsSync(runtimePath), '0112 runtime test is missing').toBe(true)
    if (!existsSync(runtimePath)) return

    const sql = readFileSync(runtimePath, 'utf8').toLowerCase()
    expect(sql).toContain('begin;')
    expect(sql).toContain('rollback;')
    expect(sql).toContain('delivered_not_included')
    expect(sql).toContain('simulated_cost_included')
    expect(sql).toContain('email_cost_included')
    expect(sql).toContain('push_customers_not_distinct')
    expect(sql).toContain('inactive_customer_included')
    expect(sql).toContain('non_platform_outbox_summary_succeeded')
    expect(sql).toMatch(/has_function_privilege\(\s*'anon'/)
    expect(sql).toMatch(/has_function_privilege\(\s*'authenticated'/)
    expect(sql).toMatch(/has_function_privilege\(\s*'service_role'/)
  })

  it('keeps 0112 in the database release inventory through migration 0120', () => {
    const workflow = readFileSync(ciPath, 'utf8')
    expect(workflow.match(/--expected-latest 0120/g)).toHaveLength(2)
    expect(workflow.match(/--required-test-versions .*0112,0113,0114,0115,0116,0117,0118,0119,0120/g)).toHaveLength(2)
  })
})
