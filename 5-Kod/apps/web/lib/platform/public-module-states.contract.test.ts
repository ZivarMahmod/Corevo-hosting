import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = fs.readFileSync(
  path.resolve(
    process.cwd(),
    '../../supabase/migrations/20260723160000_public_module_state_read.sql',
  ),
  'utf8',
)
const reader = fs.readFileSync(
  path.resolve(process.cwd(), 'lib/tenant-modules.ts'),
  'utf8',
)

describe('public module state read', () => {
  it('exposes only module key + state for active tenants through a narrow RPC', () => {
    expect(migration).toContain(
      'public.get_public_tenant_module_states(p_tenant uuid)',
    )
    expect(migration).toContain('returns table (module_key text, state text)')
    expect(migration).toContain("t.status = 'active'")
    expect(migration).toContain('grant execute')
    expect(migration).not.toContain('returns setof public.tenant_modules')
  })

  it('uses the narrow RPC so explicit off/draft rows are not mistaken for missing', () => {
    expect(reader).toContain(".rpc('get_public_tenant_module_states'")
    expect(reader).not.toContain(".from('tenant_modules')")
  })
})
