import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RESERVED_SUBDOMAINS } from '@/lib/tenant'

const migration = readFileSync(
  new URL('../../../../supabase/migrations/0122_customer_portal_rebook_origin.sql', import.meta.url),
  'utf8',
)

describe('0122 customer portal rebook origin contract', () => {
  it('uses one private tenant-bound origin resolver and the canonical booking hostname', () => {
    expect(migration).toMatch(/private\.customer_portal_booking_origin\s*\(/i)
    expect(migration).toContain("'.boka.corevo.se'")
    expect(migration).not.toMatch(/lower\(t\.slug\)\s*\|\|\s*'\.corevo\.se'/i)
  })

  it('selects a verified custom domain deterministically without requiring is_primary', () => {
    expect(migration).toMatch(/d\.verified/i)
    expect(migration).toMatch(/order by\s+d\.is_primary\s+desc\s*,\s*d\.created_at\s*,\s*d\.id/i)
    expect(migration).not.toMatch(/d\.verified\s+and\s+d\.is_primary/i)
  })

  it('projects the same tenant slug and booking origin beside every booking response', () => {
    expect(migration.match(/'tenantSlug'/g)?.length).toBeGreaterThanOrEqual(2)
    expect(migration.match(/'bookingOrigin'/g)?.length).toBeGreaterThanOrEqual(2)
    expect(migration).toContain("'{bookingOrigin}'")
    expect(migration).toMatch(/'publicRebookUrl'/)
    expect(migration).toContain("'?plats='")
    expect(migration).toContain("'&tjanst='")
    expect(migration).toMatch(/l\.active/i)
    expect(migration).toMatch(/sv\.active/i)
  })

  it('keeps SQL origin labels in exact parity with the canonical TypeScript reservation set', () => {
    for (const label of DEFAULT_RESERVED_SUBDOMAINS) {
      expect(migration).toMatch(new RegExp(`'${label}'`))
    }
  })

  it('keeps all portal read RPCs service-role only', () => {
    for (const fn of [
      'customer_portal_session_snapshot',
      'customer_portal_list_bookings',
      'customer_portal_get_booking',
    ]) {
      expect(migration).toMatch(new RegExp(`revoke all on function public\\.${fn}\\(`, 'i'))
      expect(migration).toMatch(new RegExp(`grant execute on function public\\.${fn}\\(`, 'i'))
    }
  })
})
