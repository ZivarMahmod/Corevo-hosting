import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getTenantDetail } from '@/lib/platform/tenants'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const page = fs.readFileSync(path.join(HERE, 'page.tsx'), 'utf8')
const tenantLoader = fs.readFileSync(path.join(process.cwd(), 'lib/platform/tenants.ts'), 'utf8')

type CountMetric = 'active services' | 'active staff' | 'working hours' | 'bookings' | 'completed bookings'
type FailingRead = CountMetric | 'primary address' | 'primary location'

function detailClient(failingRead: FailingRead | null, legacyAddress: string | null = null) {
  return {
    from(table: string) {
      const filters = new Map<string, unknown>()
      let isHeadCount = false

      const metric = (): CountMetric | null => {
        if (!isHeadCount) return null
        if (table === 'services') return 'active services'
        if (table === 'staff') return 'active staff'
        if (table === 'working_hours') return 'working hours'
        if (table === 'bookings') {
          return filters.get('status') === 'completed' ? 'completed bookings' : 'bookings'
        }
        return null
      }

      const result = () => {
        const countMetric = metric()
        if (countMetric === failingRead) {
          return { data: null, count: null, error: { message: `boom ${countMetric}` } }
        }
        return { data: [], count: isHeadCount ? 0 : null, error: null }
      }

      const chain = {
        select(_columns?: unknown, options?: { count?: string; head?: boolean }) {
          isHeadCount = options?.count === 'exact' && options.head === true
          return chain
        },
        eq(column: string, value: unknown) {
          filters.set(column, value)
          return chain
        },
        in() {
          return chain
        },
        order() {
          return chain
        },
        limit() {
          return chain
        },
        maybeSingle() {
          if (table === 'tenants') {
            return Promise.resolve({
              data: {
                id: 'tenant-1',
                slug: 'tenant-1',
                name: 'Tenant 1',
                status: 'active',
                created_at: '2026-01-01T00:00:00.000Z',
              },
              error: null,
            })
          }
          if (
            table === 'locations'
            && filters.get('active') === true
            && failingRead === 'primary location'
          ) {
            return Promise.resolve({
              data: null,
              error: { message: 'boom primary location' },
            })
          }
          if (table === 'locations' && !filters.has('active') && failingRead === 'primary address') {
            return Promise.resolve({
              data: null,
              error: { message: 'boom primary address' },
            })
          }
          if (table === 'locations' && !filters.has('active') && legacyAddress) {
            return Promise.resolve({ data: { address: legacyAddress }, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        },
        then(resolve: (value: ReturnType<typeof result>) => unknown) {
          return Promise.resolve(result()).then(resolve)
        },
      }

      return chain
    },
  }
}

describe('goal-72 S3 kunddetalj', () => {
  it('wires the primary location booking frame into the platform Personal tab', () => {
    expect(page).toContain('LocationOpeningHours')
    expect(page).toContain('savePlatformLocationBookingSettings')
    expect(page).toContain('primaryLocation')
    expect(tenantLoader).toMatch(
      /from\('locations'\)[\s\S]{0,300}eq\('tenant_id', tenantId\)[\s\S]{0,120}eq\('active', true\)[\s\S]{0,120}eq\('is_primary', true\)[\s\S]{0,120}order\('created_at', \{ ascending: true \}\)[\s\S]{0,120}order\('id', \{ ascending: true \}\)[\s\S]{0,80}limit\(1\)/,
    )
  })

  it('keeps the tolerant primary-address lookup deterministic', () => {
    const addressQuery = tenantLoader.match(
      /supabase\s+\.from\('locations'\)\s+\.select\('address'\)[\s\S]*?\.maybeSingle\(\),/,
    )?.[0]

    expect(addressQuery).toMatch(
      /\.select\('address'\)\s+\.eq\('tenant_id', tenantId\)\s+\.order\('is_primary', \{ ascending: false \}\)\s+\.order\('created_at', \{ ascending: true \}\)\s+\.order\('id', \{ ascending: true \}\)\s+\.limit\(1\)\s+\.maybeSingle\(\),/,
    )
  })

  it('degrades only the opening-hours card when its read fails', () => {
    expect(page).toMatch(
      /listLocationOpeningHours\(id, primaryLocation\.id\)[\s\S]{0,80}catch\(\(\) => null\)/,
    )
    expect(page).toContain('Öppettiderna kunde inte läsas')
    expect(page).toContain('Övriga delar av kundkortet fungerar fortfarande.')
    expect(page).toContain('<PersonalCard')
  })

  it('shows an honest empty state when the customer has no primary location', () => {
    expect(page).toContain('Ingen primärplats')
    expect(page).toContain('Kunden saknar en aktiv primärplats.')
    expect(page).toMatch(/!primaryLocation[\s\S]{0,500}locationOpeningHours === null/)
  })

  it('läser uteblivna exakt och tenant-scopat på servern', () => {
    expect(page).toMatch(
      /from\('bookings'\)[\s\S]{0,180}select\('id', \{ count: 'exact', head: true \}\)[\s\S]{0,120}eq\('tenant_id', id\)[\s\S]{0,80}eq\('status', 'no_show'\)/,
    )
    expect(page).toContain('if (noShowError)')
    expect(page).toContain('const noShows = noShowCount ?? 0')
  })

  it('renderar den delade Stat-raden med fyra sanningsbaserade mått och utan trendcopy', () => {
    expect(page).toContain('Stat,')
    expect(page).toContain('EmptyState,')
    expect(page).toContain('const hasOverviewData = counts.bookings > 0 || noShows > 0 || counts.activeStaff > 0')
    expect(page).toContain('<Stat label="Bokningar" value={counts.bookings} icon="calendar" />')
    expect(page).toContain('<Stat label="Genomförda" value={counts.completed} icon="checkCircle" />')
    expect(page).toContain('<Stat label="Uteblivna" value={noShows} icon="clock" />')
    expect(page).toContain('<Stat label="Personal" value={counts.activeStaff} icon="users" />')
    expect(page).toContain('<EmptyState')
    expect(page).toContain('title="Ingen statistik ännu"')
    expect(page).not.toContain('Math.round((counts.completed / counts.bookings) * 100)')
  })

  it.each<CountMetric>([
    'active services',
    'active staff',
    'working hours',
    'bookings',
    'completed bookings',
  ])('kastar vid DB-fel för count-måttet %s i stället för att visa 0', async (metric) => {
    await expect(getTenantDetail('tenant-1', detailClient(metric) as never)).rejects.toThrow(
      `boom ${metric}`,
    )
  })

  it('kastar vid DB-fel för primärplatsen i stället för att visa ett falskt tomläge', async () => {
    await expect(
      getTenantDetail('tenant-1', detailClient('primary location') as never),
    ).rejects.toThrow('boom primary location')
  })

  it('behåller ett ärligt tomläge när primärplatsläsningen lyckas utan träff', async () => {
    const detail = await getTenantDetail('tenant-1', detailClient(null) as never)

    expect(detail?.primaryLocation).toBeNull()
  })

  it('visar adress från en äldre platsrad utan att kalla den bokningsbar primärplats', async () => {
    const detail = await getTenantDetail(
      'tenant-1',
      detailClient(null, '  Arvsgatan 7  ') as never,
    )

    expect(detail?.primaryAddress).toBe('Arvsgatan 7')
    expect(detail?.primaryLocation).toBeNull()
  })

  it('kastar vid DB-fel för platsadressen i stället för att visa en falskt tom adress', async () => {
    await expect(
      getTenantDetail('tenant-1', detailClient('primary address') as never),
    ).rejects.toThrow('boom primary address')
  })
})
