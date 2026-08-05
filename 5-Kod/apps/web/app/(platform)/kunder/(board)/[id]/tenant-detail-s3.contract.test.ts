import { describe, expect, it } from 'vitest'
import { getTenantDetail } from '@/lib/platform/tenants'

type CountMetric = 'active services' | 'active staff' | 'working hours' | 'bookings' | 'completed bookings'
type FailingRead = CountMetric | 'primary address' | 'primary location'

function detailClient(failingRead: FailingRead | null, legacyAddress: string | null = null) {
  return {
    rpc(name: string) {
      if (name === 'tenant_launch_readiness') {
        return Promise.resolve({
          data: {
            ready: true,
            booking_required: false,
            canonical_host: null,
            tenant_status: 'active',
            missing: [],
          },
          error: null,
        })
      }
      if (name === 'tenant_module_readiness') {
        return Promise.resolve({
          data: { ready: true, tenant_status: 'active', modules: {} },
          error: null,
        })
      }
      throw new Error(`unexpected rpc: ${name}`)
    },
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
