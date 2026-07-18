import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  import.meta.dirname,
  '../../../../supabase/migrations/0113_platform_drift_health_truth.sql',
)
const runtimePath = resolve(
  import.meta.dirname,
  '../../../../supabase/tests/platform_drift_health_0113_test.sql',
)
const typesPath = resolve(import.meta.dirname, '../../../../packages/db/types.ts')

describe('platform drift health reader', () => {
  it('ships a platform-gated, PII-free and tenant-filterable aggregate RPC', () => {
    expect(existsSync(migrationPath), 'migration 0113 is missing').toBe(true)
    if (!existsSync(migrationPath)) return

    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('create or replace function public.platform_drift_health(')
    expect(sql).toContain('p_tenant uuid default null')
    expect(sql).toContain('if not (select private.is_platform_admin()) then')
    expect(sql).toContain('from public.notifications_outbox o')
    expect(sql).toContain('from private.scheduler_heartbeats h')
    expect(sql).toContain('o.tenant_id = p_tenant')
    expect(sql).toContain("o.status = 'queued'")
    expect(sql).toContain("o.status = 'attempting'")
    expect(sql).toContain("o.status = 'delivery_started'")
    expect(sql).toContain("o.status = 'failed'")
    expect(sql).toMatch(
      /where \(p_tenant is null or o\.tenant_id = p_tenant\)[\s\S]*?and \([\s\S]*?o\.status in \('routing', 'queued', 'attempting', 'delivery_started'\)[\s\S]*?or \(o\.status = 'failed' and o\.updated_at > now\(\) - interval '24 hours'\)[\s\S]*?\)/,
    )
    expect(sql).toContain('create index if not exists notifications_outbox_drift_active_global_idx')
    expect(sql).toContain('create index if not exists notifications_outbox_drift_active_tenant_idx')
    expect(sql).toMatch(/where status in \([\s\S]*?'routing'[\s\S]*?'failed'[\s\S]*?\)/)
    expect(sql).toContain('scheduler_healthy')
    expect(sql).toContain('scheduler_age_seconds')
    expect(sql).not.toContain("h.last_status = 'succeeded'")
    expect(sql).toContain(
      'revoke all on function public.platform_drift_health(uuid) from public, anon;',
    )
    expect(sql).toContain(
      'grant execute on function public.platform_drift_health(uuid) to authenticated, service_role;',
    )
    expect(sql).not.toMatch(/customer_id|booking_id|staff_id|payload|provider_ref/)
  })

  it('ships a rollback-safe runtime proof for denial, grants and platform success', () => {
    expect(existsSync(runtimePath), '0113 runtime test is missing').toBe(true)
    if (!existsSync(runtimePath)) return

    const sql = readFileSync(runtimePath, 'utf8')
    expect(sql).toContain('begin;')
    expect(sql).toContain('rollback;')
    expect(sql).toContain('non_platform_drift_health_succeeded')
    expect(sql).toContain('platform_drift_health_aggregate_failed')
    expect(sql).toContain('future_queued_row_missing')
    expect(sql).toContain('started_fresh_success_not_healthy')
    expect(sql).toContain('newer_failure_not_unhealthy')
    expect(sql).toContain('drift_global_index_missing')
    expect(sql).toContain('drift_tenant_index_missing')
    expect(sql).toMatch(/has_function_privilege\(\s*'anon'/)
    expect(sql).toMatch(/has_function_privilege\(\s*'authenticated'/)
    expect(sql).toMatch(/has_function_privilege\(\s*'service_role'/)
  })

  it('syncs the generated Database signature', () => {
    const types = readFileSync(typesPath, 'utf8')
    expect(types).toMatch(
      /platform_drift_health:\s*\{[\s\S]*?p_tenant\?: string[\s\S]*?attempting_count: number[\s\S]*?delivery_started_count: number[\s\S]*?failed_24h_count: number[\s\S]*?oldest_ready_at: string \| null[\s\S]*?queued_count: number[\s\S]*?scheduler_age_seconds: number \| null[\s\S]*?scheduler_healthy: boolean[\s\S]*?scheduler_last_error_code: string \| null[\s\S]*?scheduler_last_status: string \| null[\s\S]*?scheduler_name: string \| null[\s\S]*?stalled_count: number[\s\S]*?tenant_id: string \| null[\s\S]*?\}\[\]/,
    )
  })
})
