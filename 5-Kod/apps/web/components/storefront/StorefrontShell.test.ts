import {
  createElement,
  isValidElement,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WizardService } from '@/components/booking/BookingWizard'
import { SidaPreviewBridge } from '@/components/platform/SidaPreviewBridge'
import { RealtimeTenantModulesLazy } from '@/components/realtime/RealtimeTenantModulesLazy'
import type { TenantBundle } from '@/lib/tenant-data'
import { BookingProvider } from './BookingProvider'
import { CookieConsent } from './CookieConsent'
import { InlineBooking } from './InlineBooking'
import type { LayoutModuleTeasers } from './layouts/types'
import { LocalBusinessJsonLd } from './seo'
import { StorefrontShell, deriveStorefrontShellView } from './StorefrontShell'

const reads = vi.hoisted(() => ({
  copy: vi.fn(),
  moduleStates: vi.fn(),
  services: vi.fn(),
  locations: vi.fn(),
  bookingPrefs: vi.fn(),
  staffNoun: vi.fn(),
  primaryCta: vi.fn(),
  teamCount: vi.fn(),
  layoutModules: vi.fn(),
}))
vi.mock('@/lib/storefront/tenant-copy', () => ({ getTenantCopy: reads.copy }))
vi.mock('@/lib/tenant-modules', async (load) => ({
  ...(await load<typeof import('@/lib/tenant-modules')>()),
  getTenantModuleStates: reads.moduleStates,
}))
vi.mock('./wizard-services', () => ({
  getWizardServices: reads.services,
  getWizardLocations: reads.locations,
  getBookingPrefs: reads.bookingPrefs,
}))
vi.mock('@/lib/storefront/staff-noun', () => ({ resolveStaffNoun: reads.staffNoun }))
vi.mock('./primary-cta', () => ({ resolvePrimaryCta: reads.primaryCta }))
vi.mock('@/lib/storefront/team/load-team', () => ({ countTeamMembers: reads.teamCount }))
vi.mock('./layouts/load-module-teasers', async (load) => ({
  ...(await load<typeof import('./layouts/load-module-teasers')>()),
  loadLayoutModuleTeasers: reads.layoutModules,
}))
vi.mock('./layouts/runtime', () => ({
  themeChrome: () => ({ Nav: null, Footer: null, ownsUtility: false }),
}))
vi.mock('@/lib/storefront/theme-content', () => ({
  THEME_CONTENT: {
    leander: { utility: 'Leander utility' },
    freshcut: { utility: 'FreshCut utility' },
  },
  resolveTenantCopy: (_theme: string, copy: { tagline?: string } | null) => ({
    tagline: copy?.tagline ?? 'Standard tagline',
  }),
}))

const service: WizardService = {
  id: 'service-1',
  locationId: null,
  name: 'Klippning',
  description: null,
  durationMin: 45,
  priceCents: 65000,
  staff: [],
  popular: false,
}
const modules: LayoutModuleTeasers = {
  bookingReachable: false,
  shopTeasers: [],
  bloggTeasers: [],
  presentkortReachable: false,
  shopReachable: true,
  bloggReachable: false,
  offertReachable: false,
  lojalitetReachable: false,
  kurserReachable: false,
  galleriReachable: false,
}
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
type ViewInput = Parameters<typeof deriveStorefrontShellView>[0]
const view = (overrides: Partial<ViewInput> = {}) =>
  deriveStorefrontShellView({
    surface: 'public',
    theme: 'leander',
    moduleStates: { booking: 'live' },
    layoutModules: modules,
    allWizardServices: [service],
    teamCount: 0,
    rawPrimaryCta: null,
    bookingLegacyExternal: false,
    bookingVariant: 'drawer',
    ...overrides,
  })
function elements<P>(node: ReactNode, type: ElementType): ReactElement<P>[] {
  if (Array.isArray(node)) return node.flatMap((child) => elements<P>(child, type))
  if (!isValidElement(node)) return []
  const element = node as ReactElement<{ children?: ReactNode }>
  const nested = elements<P>(element.props.children, type)
  return element.type === type ? [element as ReactElement<P>, ...nested] : nested
}

function rootProps<P>(node: ReactNode): P {
  if (!isValidElement(node)) throw new Error('storefront_shell_root_missing')
  return (node as ReactElement<P>).props
}

beforeEach(() => {
  vi.clearAllMocks()
  reads.copy.mockResolvedValue(null)
  reads.moduleStates.mockResolvedValue({ booking: 'live' })
  reads.services.mockResolvedValue([service])
  reads.locations.mockResolvedValue([])
  reads.bookingPrefs.mockResolvedValue({
    mode: 'wizard',
    pickerMode: 'calendar',
    staffAvatarMode: 'initialer',
  })
  reads.staffNoun.mockResolvedValue('Personal')
  reads.primaryCta.mockResolvedValue(null)
  reads.teamCount.mockResolvedValue(0)
  reads.layoutModules.mockResolvedValue(modules)
})

describe('shared storefront shell', () => {
  it('keeps public inline published and preview inline event-controlled', () => {
    expect(view().inlineBooking).toEqual({ mounted: false, previewControlled: false })
    expect(view({ bookingVariant: 'inline' }).inlineBooking).toEqual({
      mounted: true,
      previewControlled: false,
    })
    expect(view({ surface: 'preview' }).inlineBooking).toEqual({
      mounted: true,
      previewControlled: true,
    })
  })

  it('applies one booking gate to services, navigation and CTA', () => {
    const blocked = view({
      moduleStates: { booking: 'off' },
      bookingVariant: 'inline',
      rawPrimaryCta: { label: 'Boka', href: '/boka' },
    })
    const external = view({
      moduleStates: { booking: 'off' },
      bookingLegacyExternal: true,
      rawPrimaryCta: { label: 'Boka', href: '/boka' },
    })
    expect(blocked).toMatchObject({ bookingReachable: false, wizardServices: [], primaryCta: null })
    expect(blocked.inlineBooking.mounted).toBe(false)
    expect(external).toMatchObject({
      bookingReachable: true,
      wizardServices: [service],
      primaryCta: { label: 'Boka', href: '/boka' },
    })
    expect(external.effectiveLayoutModules.bookingReachable).toBe(true)
  })

  it('keeps unreleased commerce out of cart, navigation and CTA', () => {
    const closed = view({
      layoutModules: { ...modules, shopReachable: false },
      rawPrimaryCta: { label: 'Handla', href: '/shop' },
    })
    expect(closed.cartEnabled).toBe(false)
    expect(closed.shellNavLinks).not.toContainEqual({ href: '/shop', label: 'Butik' })
    expect(closed.primaryCta).toBeNull()
  })

  it('separates public runtime extras from preview controls with their tenant props', async () => {
    const child = createElement('p', null, 'Sida')
    const publicTree = await StorefrontShell({ bundle, surface: 'public', children: child })
    const previewTree = await StorefrontShell({
      bundle,
      surface: 'preview',
      theme: 'freshcut',
      copyMode: 'keep',
      children: child,
    })
    expect(rootProps<{ 'data-theme': string; 'data-tenant': string }>(publicTree)).toMatchObject({
      'data-theme': 'leander',
      'data-tenant': 'tenant-1',
    })
    expect(rootProps<{ 'data-theme': string; 'data-tenant': string }>(previewTree)).toMatchObject({
      'data-theme': 'freshcut',
      'data-tenant': 'tenant-1',
    })
    expect(
      elements<{ tenantId: string }>(publicTree, RealtimeTenantModulesLazy)[0]?.props,
    ).toMatchObject({
      tenantId: 'tenant-1',
    })
    expect(
      elements<{
        name: string
        location: TenantBundle['location']
        contact: TenantBundle['settings']['contact']
        logoUrl: string | null
      }>(publicTree, LocalBusinessJsonLd)[0]?.props,
    ).toMatchObject({
      name: 'Studio Test',
      location: null,
      contact: { email: null, phone: null },
      logoUrl: null,
    })
    expect(elements(publicTree, CookieConsent)).toHaveLength(1)
    expect(elements(publicTree, SidaPreviewBridge)).toHaveLength(0)
    expect(elements(publicTree, InlineBooking)).toHaveLength(0)
    expect(
      elements<{
        reachable: boolean
        provider: string
        externalUrl: string | null
        services: WizardService[]
        tenantName: string
        variant: string
        countryCode: string
        locale: string
        currency: string
        defaultTimeZone: string
      }>(publicTree, BookingProvider)[0]?.props,
    ).toMatchObject({
      reachable: true,
      provider: 'corevo',
      externalUrl: null,
      services: [service],
      tenantName: 'Studio Test',
      variant: 'drawer',
      countryCode: 'SE',
      locale: 'sv-SE',
      currency: 'SEK',
      defaultTimeZone: 'Europe/Stockholm',
    })
    expect(elements(previewTree, SidaPreviewBridge)).toHaveLength(1)
    expect(
      elements<{ previewControlled?: boolean }>(previewTree, InlineBooking)[0]?.props
        .previewControlled,
    ).toBe(true)
    expect(elements(previewTree, RealtimeTenantModulesLazy)).toHaveLength(0)
    expect(elements(previewTree, LocalBusinessJsonLd)).toHaveLength(0)
    expect(elements(previewTree, CookieConsent)).toHaveLength(0)
    expect(elements(previewTree, BookingProvider)).toHaveLength(1)
    expect(reads.copy).toHaveBeenNthCalledWith(1, bundle, null, null)
    expect(reads.copy).toHaveBeenNthCalledWith(2, bundle, 'freshcut', 'keep')
  })

  it('does not mount cookie consent when the tenant disabled it', async () => {
    const tree = await StorefrontShell({
      bundle: { ...bundle, settings: { ...bundle.settings, cookieBannerEnabled: false } },
      surface: 'public',
      children: createElement('p', null, 'Sida'),
    })

    expect(elements(tree, CookieConsent)).toHaveLength(0)
  })

  it('keeps a standalone booking page link-only instead of mounting a second booking provider', async () => {
    const child = createElement('p', null, 'Fristående bokning')
    const tree = await StorefrontShell({
      bundle,
      surface: 'public',
      embeddedBooking: false,
      children: child,
    })

    expect(elements(tree, BookingProvider)).toHaveLength(0)
    expect(elements(tree, InlineBooking)).toHaveLength(0)
    expect(reads.locations).not.toHaveBeenCalled()
    expect(reads.bookingPrefs).not.toHaveBeenCalled()
    expect(elements(tree, 'p')).toContain(child)
  })
})
