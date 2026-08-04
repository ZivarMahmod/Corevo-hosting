import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenantBundle } from '@/lib/tenant-data'
import { loadPreviewBundle, loadPreviewPage } from './preview-shell'

const mocks = vi.hoisted(() => ({
  requirePortal: vi.fn(),
  createClient: vi.fn(),
  getTenantBySlug: vi.fn(),
  notFoundError: new Error('NEXT_NOT_FOUND'),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw mocks.notFoundError
  },
}))
vi.mock('@/lib/auth/session', () => ({ requirePortal: mocks.requirePortal }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/tenant-data', () => ({
  STOREFRONT_THEMES: ['leander'],
  getTenantBySlug: mocks.getTenantBySlug,
}))

const bundle: TenantBundle = {
  tenant: {
    id: 'tenant-1',
    slug: 'studio-test',
    name: 'Studio Test',
    status: 'active',
    city: null,
    vertical_id: null,
    created_at: '2026-08-04T00:00:00.000Z',
    updated_at: '2026-08-04T00:00:00.000Z',
  },
  settings: {
    branding: {},
    theme: 'leander',
    copy: null,
    paymentMode: 'none',
    portalMode: null,
    customerAccountsEnabled: false,
    contact: { email: null, phone: null },
    cookieBannerEnabled: true,
    bookingVariant: 'drawer',
    bookingExternalUrl: null,
    bookingProvider: 'corevo',
    bookingLegacyExternal: false,
    bookingExternalCtaUrls: {},
    openingHours: null,
    legal: { orgNr: null, vatRate: null },
    social: { instagram: null, facebook: null, tiktok: null },
    map: null,
    countryCode: 'SE',
    locale: 'sv-SE',
    currency: 'SEK',
    defaultTimeZone: 'Europe/Stockholm',
  },
  location: null,
}

function tenantClient(
  resolveTenant: (column: string, value: string) => Record<string, unknown> | null,
) {
  return {
    from: (table: string) => {
      if (table !== 'tenants') throw new Error(`unexpected_table:${table}`)
      return {
        select: () => ({
          eq: (column: string, value: string) => ({
            maybeSingle: async () => ({ data: resolveTenant(column, value), error: null }),
          }),
        }),
      }
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requirePortal.mockImplementation(async (portal: string) => {
    if (portal !== 'admin') throw new Error('wrong_portal_gate')
    return { platformAdmin: true, partnerAdmin: false, tenantId: null }
  })
  mocks.createClient.mockRejectedValue(new Error('unexpected_scoped_client'))
  mocks.getTenantBySlug.mockResolvedValue(bundle)
})

describe('preview tenant boundary', () => {
  it('requires an authenticated admin portal session', async () => {
    mocks.requirePortal.mockRejectedValue(new Error('portal_required'))

    await expect(loadPreviewBundle('studio-test')).rejects.toThrow('portal_required')
  })

  it('lets a platform admin preview any active tenant without a scoped tenant lookup', async () => {
    await expect(loadPreviewBundle('studio-test')).resolves.toBe(bundle)
  })

  it('loads route input, tenant, theme and copy mode through one preview bootstrap', async () => {
    await expect(
      loadPreviewPage({
        params: Promise.resolve({ slug: 'studio-test', postSlug: 'nyhet' }),
        searchParams: Promise.resolve({ theme: 'leander', copy: 'keep', page: '2' }),
      }),
    ).resolves.toMatchObject({
      params: { slug: 'studio-test', postSlug: 'nyhet' },
      searchParams: { theme: 'leander', copy: 'keep', page: '2' },
      bundle,
      theme: 'leander',
      copyMode: 'keep',
    })
  })

  it('lets a partner preview a tenant visible through the session-scoped client', async () => {
    mocks.requirePortal.mockResolvedValue({
      platformAdmin: false,
      partnerAdmin: true,
      tenantId: null,
    })
    mocks.createClient.mockResolvedValue(
      tenantClient((column, value) =>
        column === 'slug' && value === 'studio-test' ? { id: 'tenant-1' } : null,
      ),
    )

    await expect(loadPreviewBundle('studio-test')).resolves.toBe(bundle)
  })

  it('returns not found when the partner cannot see the requested slug', async () => {
    mocks.requirePortal.mockResolvedValue({
      platformAdmin: false,
      partnerAdmin: true,
      tenantId: null,
    })
    mocks.createClient.mockResolvedValue(tenantClient(() => null))

    await expect(loadPreviewBundle('outside-scope')).rejects.toBe(mocks.notFoundError)
  })

  it('lets a tenant admin preview only their own slug', async () => {
    mocks.requirePortal.mockResolvedValue({
      platformAdmin: false,
      partnerAdmin: false,
      tenantId: 'tenant-1',
    })
    mocks.createClient.mockResolvedValue(
      tenantClient((column, value) =>
        column === 'id' && value === 'tenant-1' ? { slug: 'studio-test' } : null,
      ),
    )

    await expect(loadPreviewBundle('studio-test')).resolves.toBe(bundle)
    await expect(loadPreviewBundle('another-tenant')).rejects.toBe(mocks.notFoundError)
  })

  it('returns not found when the authorized slug is unknown or inactive', async () => {
    mocks.getTenantBySlug.mockResolvedValue(null)

    await expect(loadPreviewBundle('studio-test')).rejects.toBe(mocks.notFoundError)
  })
})
