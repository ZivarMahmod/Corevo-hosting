import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')
const MIGRATION = path.join(
  CODE_ROOT,
  'supabase',
  'migrations',
  '0079_staff_readiness_invariant.sql',
)

describe('0079 staff readiness invariant', () => {
  it('creates staff as a draft before children and activates only after readiness exists', () => {
    expect(fs.existsSync(MIGRATION)).toBe(true)
    const sql = fs.readFileSync(MIGRATION, 'utf8').toLowerCase()
    const draftInsert = sql.indexOf("values (v_tenant, v_location, p_profile, pg_catalog.btrim(p_title), false)")
    const services = sql.indexOf('insert into public.staff_services', draftInsert)
    const hours = sql.indexOf('insert into public.working_hours', services)
    const activation = sql.indexOf('set active = true', hours)

    expect(draftInsert).toBeGreaterThan(-1)
    expect(services).toBeGreaterThan(draftInsert)
    expect(hours).toBeGreaterThan(services)
    expect(activation).toBeGreaterThan(hours)
  })

  it('checks active staff again after service and working-hour mutations', () => {
    expect(fs.existsSync(MIGRATION)).toBe(true)
    const sql = fs.readFileSync(MIGRATION, 'utf8').toLowerCase()

    expect(sql).toContain('create or replace function private.assert_staff_readiness(')
    expect(sql).toContain('select st.id, st.tenant_id, st.location_id, st.active')
    expect(sql).toContain('for update')
    expect(sql).toContain('if v_staff.active then')
    expect(sql).not.toMatch(/where st\.id = any[\s\S]{0,160}?and st\.active = true[\s\S]{0,80}?for update/)
    expect(sql).toContain("raise exception 'active_staff_requires_matching_service'")
    expect(sql).toContain("raise exception 'active_staff_requires_working_hours'")
    expect(sql).toMatch(
      /create constraint trigger trg_staff_services_readiness[\s\S]*?after insert or update or delete on public\.staff_services[\s\S]*?deferrable initially deferred/,
    )
    expect(sql).toMatch(
      /create constraint trigger trg_working_hours_readiness[\s\S]*?after insert or update or delete on public\.working_hours[\s\S]*?deferrable initially deferred/,
    )
  })

  it('also revalidates active staff when a linked service is deactivated', () => {
    expect(fs.existsSync(MIGRATION)).toBe(true)
    const sql = fs.readFileSync(MIGRATION, 'utf8').toLowerCase()

    expect(sql).toMatch(
      /create constraint trigger trg_services_staff_readiness[\s\S]*?after update or delete on public\.services[\s\S]*?deferrable initially deferred/,
    )
  })
})
