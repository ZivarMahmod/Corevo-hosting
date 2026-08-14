import { Fragment, isValidElement, type ReactElement, type ReactNode } from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenantBundle } from '@/lib/tenant-data'

const state = vi.hoisted(() => ({
  requestHeaders: null as Headers | null,
  updateSession: vi.fn(),
  currentTenant: vi.fn(),
  getServices: vi.fn(),
  loadLayoutModuleTeasers: vi.fn(),
}))

vi.mock('@/lib/supabase/middleware', () => ({ updateSession: state.updateSession }))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => state.requestHeaders ?? new Headers()),
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
vi.mock('@/lib/url', () => ({
  requestOrigin: vi.fn(async () => 'https://freshcut.corevo.se'),
}))
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

import { middleware } from '../../middleware'
import HomePage from '@/app/(public)/page'
import PublicLayout, { generateMetadata } from '@/app/(public)/layout'
import robots from '@/app/(public)/robots'
import { FreshCutLayout } from '@/components/storefront/layouts/FreshCutLayout'

const bundle = {
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
} satisfies TenantBundle

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

describe('live FreshCut motiontest-header spoof boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.requestHeaders = null
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
    state.updateSession.mockImplementation(async (_request, requestHeaders: Headers) => {
      state.requestHeaders = new Headers(requestHeaders)
      return { response: NextResponse.next(), user: null }
    })
  })

  it('keeps exact live host layout, shell, metadata, and robots ordinary', async () => {
    await middleware(
      new NextRequest('https://freshcut.corevo.se/', {
        headers: {
          host: 'freshcut.corevo.se',
          'x-corevo-storefront-experience': 'freshcut-motiontest',
        },
      }),
    )

    expect(state.requestHeaders?.get('x-corevo-storefront-experience')).toBeNull()
    expect(firstElement(await HomePage())?.type).toBe(FreshCutLayout)
    expect(firstElement(await PublicLayout({ children: 'ordinary' }))?.props).not.toHaveProperty(
      'experience',
    )

    const metadata = await generateMetadata()
    expect(metadata.robots).toBeUndefined()
    expect(
      new URL(String(metadata.alternates?.canonical), metadata.metadataBase ?? undefined).href,
    ).toBe('https://freshcut.corevo.se/')
    await expect(robots()).resolves.toEqual({
      rules: [{ userAgent: '*', allow: '/', disallow: ['/konto', '/api/'] }],
      sitemap: 'https://freshcut.corevo.se/sitemap.xml',
    })
  })
})
