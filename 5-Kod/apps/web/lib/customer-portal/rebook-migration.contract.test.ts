import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RESERVED_SUBDOMAINS } from '@/lib/tenant'

const portalMigration = readFileSync(
  new URL('../../../../supabase/migrations/0122_customer_portal_rebook_origin.sql', import.meta.url),
  'utf8',
)
const migrationDirectory = new URL('../../../../supabase/migrations/', import.meta.url)
const currentOriginMigration = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, migrationDirectory), 'utf8'))
  .filter((sql) => /create or replace function private\.customer_portal_booking_origin\s*\(/i.test(sql))
  .at(-1)

if (!currentOriginMigration) {
  throw new Error('customer_portal_booking_origin migration missing')
}

describe('customer portal rebook origin contract', () => {
  it('uses one private tenant-bound origin resolver and the canonical booking hostname', () => {
    expect(currentOriginMigration).toMatch(/private\.customer_portal_booking_origin\s*\(/i)
    expect(currentOriginMigration).toContain("'.corevo.se'")
    expect(currentOriginMigration).not.toContain("'.boka.corevo.se'")
    expect(currentOriginMigration).not.toMatch(/lower\(t\.slug\)\s*\|\|\s*'\.corevo\.se'/i)
  })

  it('selects a verified custom domain deterministically without requiring is_primary', () => {
    expect(currentOriginMigration).toMatch(/d\.verified/i)
    expect(currentOriginMigration).toMatch(/order by\s+d\.is_primary\s+desc\s*,\s*d\.created_at\s*,\s*d\.id/i)
    expect(currentOriginMigration).not.toMatch(/d\.verified\s+and\s+d\.is_primary/i)
  })

  it('projects the same tenant slug and booking origin beside every booking response', () => {
    expect(portalMigration.match(/'tenantSlug'/g)?.length).toBeGreaterThanOrEqual(2)
    expect(portalMigration.match(/'bookingOrigin'/g)?.length).toBeGreaterThanOrEqual(2)
    expect(portalMigration).toContain("'{bookingOrigin}'")
    expect(portalMigration).toMatch(/'publicRebookUrl'/)
    expect(portalMigration).toContain("'?plats='")
    expect(portalMigration).toContain("'&tjanst='")
    expect(portalMigration).toMatch(/l\.active/i)
    expect(portalMigration).toMatch(/sv\.active/i)
  })

  it('keeps SQL origin labels in exact parity with the canonical TypeScript reservation set', () => {
    for (const label of DEFAULT_RESERVED_SUBDOMAINS) {
      expect(currentOriginMigration).toMatch(new RegExp(`'${label}'`))
    }
  })

  it('keeps all portal read RPCs service-role only', () => {
    for (const fn of [
      'customer_portal_session_snapshot',
      'customer_portal_list_bookings',
      'customer_portal_get_booking',
    ]) {
      expect(portalMigration).toMatch(new RegExp(`revoke all on function public\\.${fn}\\(`, 'i'))
      expect(portalMigration).toMatch(new RegExp(`grant execute on function public\\.${fn}\\(`, 'i'))
    }
  })
})
