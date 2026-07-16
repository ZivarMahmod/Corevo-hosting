import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')
const actions = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'calendar-actions.ts'), 'utf8')
const migration = fs.readFileSync(
  path.join(CODE_ROOT, 'supabase', 'migrations', '0077_atomic_location_admin_booking_flows.sql'),
  'utf8',
)

describe('time_off 0077 wiring', () => {
  it('skapar en hel serie atomiskt via den platsfencade RPC:n', () => {
    expect(actions).toContain("rpc('create_admin_time_off_series'")
    expect(actions).toContain('p_occurrences: occurrences')
    expect(actions).not.toMatch(/from\('time_off'\)\.insert/)
    expect(migration).toContain('create or replace function public.create_admin_time_off_series(')
    expect(migration).toContain('jsonb_array_length(p_occurrences) not between 1 and 400')
  })

  it('tar bort en eller framåt via serverägd audit-RPC', () => {
    expect(actions).toContain("rpc('delete_admin_time_off'")
    expect(actions).not.toMatch(/from\('time_off'\)[\s\S]{0,180}\.delete\(/)
    expect(migration).toContain("'time_off.deleted'")
  })
})
