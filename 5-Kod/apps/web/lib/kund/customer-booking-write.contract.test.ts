import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

describe('kundens bokningsskrivningar', () => {
  it('exponerar ingen rå kund-UPDATE-policy', () => {
    const sql = fs.readFileSync(
      path.join(CODE_ROOT, 'supabase', 'migrations', '0071_role_aware_admin_rls.sql'),
      'utf8',
    )
    expect(sql).toContain('drop policy if exists bookings_customer_cancel')
    expect(sql).not.toContain('create policy bookings_customer_cancel')
  })
})
