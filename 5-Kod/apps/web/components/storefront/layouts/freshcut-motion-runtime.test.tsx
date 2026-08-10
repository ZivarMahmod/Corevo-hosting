import { Fragment, isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenantBundle } from '@/lib/tenant-data'

const state = vi.hoisted(() => ({
  experience: null as string | null,
  origin: 'https://freshcut.corevo.se',
  currentTenant: vi.fn(),
  getServices: vi.fn(),
  loadLayoutModuleTeasers: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers(
    state.experience
      ? { 'x-corevo-storefront-experience': state.experience }
      : undefined,
  )),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/lib/tenant-data', () => ({
  currentTenant: state.currentTenant,
  getServices: state.getServices,
}))
vi.mock('@/lib/url', () => ({ requestOrigin: vi.fn(async () => state.origin) }))
vi.mock('@/lib/storefront/tenant-copy', () => ({ getTenantCopy: vi.fn(async () => null) }))
vi.mock('@/lib/storefront/theme-content', () => ({ resolveThemeContent: vi.fn(() => ({})) }))
vi.mock('@/components/storefront/layouts/load-module-teasers', () => ({
  loadLayoutModuleTeasers: state.loadLayoutModuleTeasers,
  withLegacyExternalBooking: vi.fn((modules) => modules),
}))
vi.mock('@/components/storefront/StorefrontModuleSections', () => ({
  StorefrontModuleSections: 'test-storefront-module-sections',
}))
vi.mock('@/components/storefront/StorefrontShell', () => ({
  StorefrontShell: 'test-storefront-shell',
}))

import * as runtime from './runtime'
import { resolveStorefrontLayout } from './runtime'
import { FreshCutLayout } from './FreshCutLayout'
import { FreshCutMotionLayout } from './FreshCutMotionLayout'
import HomePage from '@/app/(public)/page'
import { generateMetadata } from '@/app/(public)/layout'
import robots from '@/app/(public)/robots'

const bundle: TenantBundle = {
  tenant: {
    id: 'tenant-freshcut',
    slug: 'freshcut',
    name: 'FreshCut',
    status: 'active',
    city: 'Linköping',
    vertical_id: null,
    created_at: '2026-08-10T00:00:00.000Z',
    updated_at: '2026-08-10T00:00:00.000Z',
  },
  settings: {
    branding: {},
    theme: 'freshcut',
    copy: null,
    paymentMode: 'none',
    portalMode: null,
    customerAccountsEnabled: false,
    contact: { email: null, phone: null },
    cookieBannerEnabled: false,
    bookingVariant: 'drawer',
    bookingExternalUrl: 'https://www.bokadirekt.se/places/freshcut-123',
    bookingProvider: 'external',
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

function firstElement(node: ReactNode): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const element = firstElement(child)
      if (element) return element
    }
    return null
  }
  if (!isValidElement(node)) return null
  if (node.type !== Fragment) return node
  return firstElement((node.props as { children?: ReactNode }).children)
}

describe('FreshCut motiontest runtime selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.experience = null
    state.origin = 'https://freshcut.corevo.se'
    state.currentTenant.mockResolvedValue(bundle)
    state.getServices.mockResolvedValue([])
    state.loadLayoutModuleTeasers.mockResolvedValue({
      bookingReachable: true,
      shopTeasers: [],
      bloggTeasers: [],
      presentkortReachable: false,
      shopReachable: false,
      bloggReachable: false,
      offertReachable: false,
      lojalitetReachable: false,
      kurserReachable: false,
      galleriReachable: false,
    })
  })

  it('keeps the ordinary FreshCut registry entry and selects motion only for FreshCut', () => {
    expect(runtime.STOREFRONT_LAYOUTS.freshcut).toBe(FreshCutLayout)
    expect(resolveStorefrontLayout('freshcut', 'freshcut-motiontest')).toBe(FreshCutMotionLayout)
    expect(resolveStorefrontLayout('freshcut', null)).toBe(FreshCutLayout)
    expect(resolveStorefrontLayout('leander', 'freshcut-motiontest')).toBe(
      runtime.STOREFRONT_LAYOUTS.leander,
    )
  })

  it('makes the public page consume the trusted experience header', async () => {
    state.experience = 'freshcut-motiontest'
    const motionTree = await HomePage()
    expect(firstElement(motionTree)?.type).toBe(FreshCutMotionLayout)

    state.experience = 'spoofed-value'
    const ordinaryTree = await HomePage()
    expect(firstElement(ordinaryTree)?.type).toBe(FreshCutLayout)
  })

  it('keeps a host-specific canonical while marking motion metadata noindex', async () => {
    state.experience = 'freshcut-motiontest'
    state.origin = 'https://motiontest.corevo.se'

    const metadata = await generateMetadata()

    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(new URL(String(metadata.alternates?.canonical), metadata.metadataBase ?? undefined).href)
      .toBe('https://motiontest.corevo.se/')
  })

  it('keeps ordinary FreshCut metadata indexable', async () => {
    const metadata = await generateMetadata()
    expect(metadata.robots).toBeUndefined()
  })

  it('disallows the motiontest root without publishing a sitemap', async () => {
    state.experience = 'freshcut-motiontest'

    const policy = await robots()

    expect(policy).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] })
    expect(policy).not.toHaveProperty('sitemap')
  })

  it('preserves ordinary FreshCut robots behavior', async () => {
    const policy = await robots()

    expect(policy).toEqual({
      rules: [{ userAgent: '*', allow: '/', disallow: ['/konto', '/api/'] }],
      sitemap: 'https://freshcut.corevo.se/sitemap.xml',
    })
  })
})
