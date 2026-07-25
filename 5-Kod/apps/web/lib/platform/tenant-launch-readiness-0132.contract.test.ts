import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/0132_tenant_launch_booking_tuple.sql',
)
const correctionPath = resolve(
  process.cwd(),
  '../../supabase/migrations/0133_tenant_launch_booking_default.sql',
)
const runtimePath = resolve(
  process.cwd(),
  '../../supabase/tests/tenant_launch_booking_tuple_0132_test.sql',
)
const migration = readFileSync(migrationPath, 'utf8').toLowerCase()
const runtime = readFileSync(runtimePath, 'utf8').toLowerCase()

describe('goal-84 launch readiness booking tuple', () => {
  it('ships the unapplied correction as one migration with one contract', () => {
    expect(existsSync(correctionPath)).toBe(false)
    expect(migration).toContain('create or replace function private.tenant_launch_missing(p_tenant uuid)')
    expect(migration).toContain('create or replace function public.tenant_launch_readiness(p_tenant uuid)')
    expect(migration).toContain('create or replace function public.publish_tenant(p_tenant uuid)')
    expect(
      migration.match(
        /select coalesce\(\([\s\S]*?tm\.state = 'live'[\s\S]*?\), true\) into v_booking_required;/g,
      ),
    ).toHaveLength(3)
  })

  it('requires one real service/staff/location weekday tuple for working_hours', () => {
    for (const table of [
      'public.services svc',
      'public.staff_services ss',
      'public.staff st',
      'public.working_hours wh',
      'public.location_opening_hours loh',
      'public.working_hour_slots ws',
    ]) expect(migration).toContain(table)
    expect(migration).toContain('ws.active = true')
    expect(migration).toContain('ws.weekday = wh.weekday')
    expect(migration).toContain('not exists (')
    expect(migration).toContain('coalesce(svc.slot_step_min, st.slot_step_min, l.slot_step_min, 15)')
    expect(migration).toContain("date '2000-01-01' + ws.start_time")
    expect(migration).toContain("date '2000-01-01' + wh.start_time")
    expect(migration).toContain("pg_catalog.date_part('epoch', wh.end_time - wh.start_time)")
    expect(migration).not.toContain('pg_catalog.extract(')
    expect(migration).toContain("'working_hours'")
    expect(migration).toContain("'confirmed_opening_hours'")
  })

  it('hardens every definer and exposes only the intended public RPCs', () => {
    expect(migration.match(/security definer/g)).toHaveLength(3)
    expect(migration.match(/set search_path = ''/g)).toHaveLength(3)
    expect(migration).toMatch(
      /revoke all on function private\.tenant_launch_missing\(uuid\)\s+from public, anon, authenticated, service_role/,
    )
    for (const fn of ['tenant_launch_readiness', 'publish_tenant']) {
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function public\\.${fn}\\(uuid\\)\\s+from public, anon, authenticated, service_role`,
        ),
      )
      expect(migration).toMatch(
        new RegExp(
          `grant execute on function public\\.${fn}\\(uuid\\)\\s+to authenticated, service_role`,
        ),
      )
    }
  })

  it('aligns opening-hours reads with the partner-capable tenant write gate', () => {
    expect(migration).toMatch(
      /drop policy if exists location_opening_hours_read\s+on public\.location_opening_hours/,
    )
    expect(migration).toMatch(
      /create policy location_opening_hours_read\s+on public\.location_opening_hours\s+for select to authenticated\s+using \(\s*\(select private\.can_access_tenant\(location_opening_hours\.tenant_id\)\)/,
    )
    expect(migration).toContain(
      'location_opening_hours.tenant_id = (select private.tenant_id())',
    )
    expect(migration).toContain(
      '(select private.can_access_location(location_opening_hours.location_id))',
    )
    expect(migration).toContain('(select private.role_level()) = 2')
  })

  it('keeps one rollback-safe runtime proof for every Goal 84 database case', () => {
    for (const proof of [
      'goal84_valid_tuple_not_ready',
      'goal84_missing_booking_row_failed_open',
      'goal84_missing_booking_publish_not_blocked',
      'goal84_explicit_booking_off_not_honored',
      'goal84_explicit_booking_off_publish_failed',
      'goal84_wrong_weekday_not_blocked',
      'goal84_short_overlap_not_blocked',
      'goal84_unfitting_explicit_start_not_blocked',
      'goal84_valid_explicit_start_not_ready',
      'goal84_missing_confirmation_not_blocked',
      'goal84_publish_not_idempotent',
      'goal84_direct_active_should_have_been_blocked',
      'goal84_runtime_rollback',
    ]) {
      expect(runtime).toContain(proof)
    }
    expect(runtime).toContain("when sqlstate '55000' then null")
  })
})
