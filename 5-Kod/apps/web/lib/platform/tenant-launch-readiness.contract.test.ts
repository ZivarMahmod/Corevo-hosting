import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/0127_tenant_launch_readiness.sql',
  ),
  'utf8',
).toLowerCase()

describe('goal-76 tenant launch readiness migration', () => {
  it('uses one private readiness source for the read RPC and activation trigger', () => {
    expect(migration).toContain(
      'create or replace function private.tenant_launch_missing(p_tenant uuid)',
    )
    expect(migration).toContain(
      'create or replace function public.tenant_launch_readiness(p_tenant uuid)',
    )
    expect(migration).toContain(
      'create or replace function private.enforce_tenant_launch_readiness()',
    )
    expect(migration).toMatch(
      /create trigger trg_tenant_launch_readiness[\s\S]*before insert or update of status on public\.tenants/,
    )
  })

  it('checks generic foundations and every booking dependency', () => {
    for (const key of [
      'tenant_settings',
      'primary_location',
      'owner',
      'canonical_host',
      'bookable_service',
      'bookable_staff',
      'service_assignment',
      'working_hours',
      'confirmed_opening_hours',
    ]) {
      expect(migration).toContain(`'${key}'`)
    }
    expect(migration).toContain("tm.module_key = 'booking'")
    expect(migration).toContain("tm.state = 'live'")
    expect(migration).toContain('if v_booking_required then')
  })

  it('publishes under a tenant row lock and is idempotent', () => {
    expect(migration).toContain(
      'create or replace function public.publish_tenant(p_tenant uuid)',
    )
    expect(migration).toMatch(
      /from public\.tenants t[\s\S]*where t\.id = p_tenant[\s\S]*for update/,
    )
    expect(migration).toContain("if v_status = 'active' then")
    expect(migration).toContain("'transitioned', false")
    expect(migration).toContain("'transitioned', true")
    expect(migration).toContain("raise exception 'tenant_not_ready'")
  })

  it('hardens every definer and exposes only the two intended RPCs', () => {
    expect(migration.match(/security definer/g)?.length).toBeGreaterThanOrEqual(4)
    expect(migration.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(4)
    expect(migration).toMatch(
      /revoke all on function public\.tenant_launch_readiness\(uuid\)\s+from public, anon, authenticated/,
    )
    expect(migration).toMatch(
      /revoke all on function public\.publish_tenant\(uuid\)\s+from public, anon, authenticated/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.tenant_launch_readiness\(uuid\)\s+to authenticated, service_role/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.publish_tenant\(uuid\)\s+to authenticated, service_role/,
    )
  })
})
