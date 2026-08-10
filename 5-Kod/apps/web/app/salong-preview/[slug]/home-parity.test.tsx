import { isValidElement, type ElementType, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenantBundle } from '@/lib/tenant-data'
import type { LayoutModuleTeasers } from '@/components/storefront/layouts/types'
import PublicHomePage from '@/app/(public)/page'
import { AteljeVinterLayout } from '@/components/storefront/layouts/florist/AteljeVinterLayout'
import PreviewHomePage from './page'

const reads = vi.hoisted(() => ({
  currentTenant: vi.fn(),
  services: vi.fn(),
  previewBundle: vi.fn(),
  layoutModules: vi.fn(),
  copy: vi.fn(),
}))

vi.mock('@/lib/tenant-data', () => ({
  currentTenant: reads.currentTenant,
  getServices: reads.services,
}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/components/storefront/layouts/load-module-teasers', async (load) => ({
  ...(await load<typeof import('@/components/storefront/layouts/load-module-teasers')>()),
  loadLayoutModuleTeasers: reads.layoutModules,
}))
vi.mock('@/lib/storefront/theme-content', () => ({ resolveThemeContent: () => ({}) }))
vi.mock('@/lib/storefront/tenant-copy', () => ({ getTenantCopy: reads.copy }))
vi.mock('@/components/storefront/StorefrontModuleSections', () => ({
  StorefrontModuleSections: 'test-module-sections',
}))
vi.mock('@/components/storefront/StorefrontShell', () => ({
  StorefrontShell: 'test-storefront-shell',
}))
vi.mock('./preview-shell', () => ({
  loadPreviewPage: async () => ({
    bundle: await reads.previewBundle(),
    theme: 'ateljevinter',
    copyMode: null,
  }),
}))

const bundle: TenantBundle = {
  tenant: {
    id: 'tenant-1', slug: 'studio-test', name: 'Studio Test', status: 'active', city: null,
    vertical_id: null, created_at: '2026-08-04T00:00:00.000Z', updated_at: '2026-08-04T00:00:00.000Z',
  },
  settings: {
    branding: {}, theme: 'ateljevinter', copy: null,
    paymentMode: 'none', portalMode: null, customerAccountsEnabled: false,
    contact: { email: null, phone: null },
    cookieBannerEnabled: true, bookingVariant: 'drawer', bookingExternalUrl: 'https://booking.example.test',
    bookingProvider: 'external', bookingLegacyExternal: true, bookingExternalCtaUrls: {},
    openingHours: null, legal: { orgNr: null, vatRate: null },
    social: { instagram: null, facebook: null, tiktok: null }, map: null,
    countryCode: 'SE', locale: 'sv-SE', currency: 'SEK', defaultTimeZone: 'Europe/Stockholm',
  },
  location: null,
}
const modules: LayoutModuleTeasers = {
  bookingReachable: false, shopTeasers: [], bloggTeasers: [], presentkortReachable: false,
  shopReachable: false, bloggReachable: false, offertReachable: false,
  lojalitetReachable: false, kurserReachable: false, galleriReachable: false,
}

function elements<P>(node: ReactNode, type: ElementType): ReactElement<P>[] {
  if (Array.isArray(node)) return node.flatMap((child) => elements<P>(child, type))
  if (!isValidElement(node)) return []
  const element = node as ReactElement<{ children?: ReactNode }>
  const nested = elements<P>(element.props.children, type)
  return element.type === type ? [element as ReactElement<P>, ...nested] : nested
}

beforeEach(() => {
  vi.clearAllMocks()
  reads.currentTenant.mockResolvedValue(bundle)
  reads.previewBundle.mockResolvedValue(bundle)
  reads.services.mockResolvedValue([])
  reads.layoutModules.mockResolvedValue(modules)
  reads.copy.mockResolvedValue(null)
})

describe('public and preview storefront home parity', () => {
  it('keeps legacy external booking reachable inside both theme layouts', async () => {
    const publicTree = await PublicHomePage()
    const previewTree = await PreviewHomePage({
      params: Promise.resolve({ slug: 'studio-test' }),
      searchParams: Promise.resolve({}),
    })
    const publicLayout = elements<{ modules?: LayoutModuleTeasers }>(publicTree, AteljeVinterLayout)[0]
    const previewLayout = elements<{ modules?: LayoutModuleTeasers }>(previewTree, AteljeVinterLayout)[0]

    expect(publicLayout?.props.modules?.bookingReachable).toBe(true)
    expect(previewLayout?.props.modules?.bookingReachable).toBe(true)
  })

  it('keeps booking closed on both surfaces without a live or legacy external provider', async () => {
    const corevoBundle: TenantBundle = {
      ...bundle,
      settings: {
        ...bundle.settings,
        bookingProvider: 'corevo',
        bookingLegacyExternal: false,
        bookingExternalUrl: null,
      },
    }
    reads.currentTenant.mockResolvedValue(corevoBundle)
    reads.previewBundle.mockResolvedValue(corevoBundle)

    const publicTree = await PublicHomePage()
    const previewTree = await PreviewHomePage({
      params: Promise.resolve({ slug: 'studio-test' }),
      searchParams: Promise.resolve({}),
    })
    const publicLayout = elements<{ modules?: LayoutModuleTeasers }>(publicTree, AteljeVinterLayout)[0]
    const previewLayout = elements<{ modules?: LayoutModuleTeasers }>(previewTree, AteljeVinterLayout)[0]

    expect(publicLayout?.props.modules?.bookingReachable).toBe(false)
    expect(previewLayout?.props.modules?.bookingReachable).toBe(false)
  })
})
