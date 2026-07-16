import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const CODE_ROOT = path.resolve(ROOT, '..', '..', '..', '..')

describe('kundens bokningsskrivningar', () => {
  it('exponerar ingen rå kund-UPDATE-policy och skriver efter serverns cutoff-vakt', () => {
    const sql = fs.readFileSync(
      path.join(CODE_ROOT, 'supabase', 'migrations', '0071_role_aware_admin_rls.sql'),
      'utf8',
    )
    const actions = fs.readFileSync(path.join(ROOT, 'actions.ts'), 'utf8')

    expect(sql).toContain('drop policy if exists bookings_customer_cancel')
    expect(sql).not.toContain('create policy bookings_customer_cancel')
    expect(actions).toContain('withinCancellationWindow')
    expect(actions).toContain('const admin = createAdminClient()')
    expect(actions).toContain("cancelled_by: 'customer'")
  })
})
