import { describe, expect, it, vi } from 'vitest'
import { renderToReadableStream } from 'react-dom/server'

vi.mock('@/lib/tenant-modules', () => ({
  getTenantModuleStates: vi.fn(async () => ({
    kurser: 'live',
    galleri: 'live',
  })),
  isModuleLive: (states: Record<string, string>, key: string) => states[key] === 'live',
}))

vi.mock('@/components/storefront/ShopSection', () => ({ ShopSection: () => null }))
vi.mock('@/components/storefront/OffertSection', () => ({ OffertSection: () => null }))
vi.mock('@/components/storefront/BloggSection', () => ({ BloggSection: () => null }))
vi.mock('@/components/storefront/LojalitetSection', () => ({ LojalitetSection: () => null }))
vi.mock('@/components/storefront/PresentkortSection', () => ({ PresentkortSection: () => null }))
vi.mock('@/components/storefront/shop/EventSeatBuy', () => ({ EventSeatBuy: () => null }))
vi.mock('@/components/storefront/KursAnmalanForm', () => ({ KursAnmalanForm: () => null }))

vi.mock('@/lib/storefront/kurser/load-kurser', () => ({
  loadUpcomingEvents: vi.fn(async () => []),
  loadKurserConfig: vi.fn(async () => ({ payment: 'onsite' })),
}))

vi.mock('@/lib/storefront/galleri/load-galleri', () => ({
  loadGalleriData: vi.fn(async () => ({ items: [] })),
}))

import { StorefrontModuleSections } from './StorefrontModuleSections'

describe('StorefrontModuleSections fallback', () => {
  it('renders the empty state for a live gallery', async () => {
    const sections = await StorefrontModuleSections({
      tenantId: 'tenant-1',
      slug: 'demosalong',
      variant: 'teaser',
    })
    const html = await new Response(await renderToReadableStream(sections)).text()
    expect(html).toContain('data-module="galleri"')
    expect(html).toContain('Bilder visas snart.')
  })
})
