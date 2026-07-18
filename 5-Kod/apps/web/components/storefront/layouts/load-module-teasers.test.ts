import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  states: {} as Record<string, 'off' | 'draft' | 'live' | 'paused'>,
  products: [] as { id: string }[],
  posts: [] as { id: string }[],
  galleryItems: [] as { id: string }[],
  upcomingEvents: 0,
  throwOn: new Set<string>(),
}))

vi.mock('@/lib/tenant-modules', () => ({
  getTenantModuleStates: vi.fn(async () => {
    if (mocks.throwOn.has('states')) throw new Error('states unavailable')
    return mocks.states
  }),
  isModuleLive: (states: typeof mocks.states, key: string) => states[key] === 'live',
  isModulePaused: (states: typeof mocks.states, key: string) => states[key] === 'paused',
}))

vi.mock('@/lib/storefront/shop/load-shop', () => ({
  loadShopData: vi.fn(async () => {
    if (mocks.throwOn.has('shop')) throw new Error('shop unavailable')
    return { products: mocks.products }
  }),
}))

vi.mock('@/lib/storefront/blogg/load-blogg', () => ({
  loadBloggData: vi.fn(async () => {
    if (mocks.throwOn.has('blogg')) throw new Error('blogg unavailable')
    return { posts: mocks.posts }
  }),
}))

vi.mock('@/lib/storefront/galleri/load-galleri', () => ({
  loadGalleriData: vi.fn(async () => ({ items: mocks.galleryItems })),
}))

vi.mock('@/lib/storefront/offert/load-offert', () => ({
  loadOffertData: vi.fn(async () => ({ config: {} })),
}))

vi.mock('@/lib/storefront/presentkort/load-presentkort', () => ({
  loadPresentkortData: vi.fn(async () => ({ config: {} })),
}))

vi.mock('@/lib/storefront/lojalitet/load-lojalitet', () => ({
  loadLojalitetData: vi.fn(async () => ({ config: {}, plans: [] })),
}))

vi.mock('@/lib/storefront/kurser/load-kurser', () => ({
  countUpcomingEvents: vi.fn(async () => mocks.upcomingEvents),
}))

import { loadLayoutModuleTeasers } from './load-module-teasers'

describe('loadLayoutModuleTeasers reachability contract', () => {
  beforeEach(() => {
    vi.stubEnv('COREVO_COMMERCE_RELEASE', 'settlement-v1-verified')
    vi.stubEnv('COREVO_COMMERCE_TENANT_IDS', 'tenant-1,tenant-errors')
    mocks.states = {}
    mocks.products = []
    mocks.posts = []
    mocks.galleryItems = []
    mocks.upcomingEvents = 0
    mocks.throwOn.clear()
  })

  it.each(['off', 'draft'] as const)('keeps %s modules unreachable even when data exists', async (state) => {
    mocks.states = Object.fromEntries(
      ['booking', 'shop', 'blogg', 'offert', 'presentkort', 'lojalitet', 'kurser', 'galleri'].map((key) => [key, state]),
    )
    mocks.products = [{ id: 'product-1' }]
    mocks.galleryItems = [{ id: 'image-1' }]
    mocks.upcomingEvents = 1

    const modules = await loadLayoutModuleTeasers('tenant-1', 'tenant')

    expect(modules).toMatchObject({
      shopReachable: false,
      bookingReachable: false,
      bloggReachable: false,
      offertReachable: false,
      presentkortReachable: false,
      lojalitetReachable: false,
      kurserReachable: false,
      galleriReachable: false,
    })
  })

  it.each(['live', 'paused'] as const)('requires target data for %s shop, courses and gallery links', async (state) => {
    mocks.states = Object.fromEntries(
      ['booking', 'shop', 'blogg', 'offert', 'presentkort', 'lojalitet', 'kurser', 'galleri'].map((key) => [key, state]),
    )

    const empty = await loadLayoutModuleTeasers('tenant-1', 'tenant')
    expect(empty).toMatchObject({
      shopReachable: false,
      bookingReachable: true,
      bloggReachable: false,
      offertReachable: true,
      presentkortReachable: true,
      lojalitetReachable: true,
      kurserReachable: false,
      galleriReachable: false,
    })

    mocks.products = [{ id: 'product-1' }]
    mocks.posts = [{ id: 'post-1' }]
    mocks.galleryItems = [{ id: 'image-1' }]
    mocks.upcomingEvents = 1
    const filled = await loadLayoutModuleTeasers('tenant-1', 'tenant')
    expect(filled).toMatchObject({
      shopReachable: true,
      bloggReachable: true,
      kurserReachable: true,
      galleriReachable: true,
    })
  })

  it('fails only the optional module whose loader throws', async () => {
    mocks.states = {
      booking: 'live',
      shop: 'live',
      blogg: 'live',
      offert: 'live',
    }
    mocks.products = [{ id: 'product-1' }]
    mocks.posts = [{ id: 'post-1' }]
    mocks.throwOn.add('shop')

    await expect(loadLayoutModuleTeasers('tenant-errors', 'tenant-errors')).resolves.toMatchObject({
      bookingReachable: true,
      shopReachable: false,
      bloggReachable: true,
      offertReachable: true,
    })
  })

  it('fails the whole reachability result closed when module-state loading throws', async () => {
    mocks.throwOn.add('states')
    await expect(loadLayoutModuleTeasers('tenant-state-error', 'tenant-state-error')).resolves.toMatchObject({
      bookingReachable: false,
      shopReachable: false,
      bloggReachable: false,
      offertReachable: false,
      presentkortReachable: false,
      lojalitetReachable: false,
      kurserReachable: false,
      galleriReachable: false,
    })
  })
})
