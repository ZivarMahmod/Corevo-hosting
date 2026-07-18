import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { STOREFRONT_THEMES, type Service, type StorefrontTheme } from '@/lib/tenant-data'
import { resolveThemeContent } from '../theme-content'
import { STOREFRONT_LAYOUTS } from './index'
import type { LayoutModuleTeasers } from './types'

const SERVICE = {
  id: 'service-1',
  tenant_id: 'tenant-1',
  name: 'Tjänst',
  description: 'Beskrivning',
  duration_min: 30,
  price_cents: 50000,
  active: true,
} as Service

const OFF: LayoutModuleTeasers = {
  bookingReachable: false,
  shopTeasers: [],
  bloggTeasers: [],
  presentkortReachable: false,
  shopReachable: false,
  bloggReachable: false,
  offertReachable: false,
  lojalitetReachable: false,
  kurserReachable: false,
  galleriReachable: false,
}

const REACHABLE: LayoutModuleTeasers = {
  ...OFF,
  bookingReachable: true,
  shopTeasers: [
    { id: 'product-1', name: 'Produkt', priceCents: 39900, currency: 'SEK', imageUrl: null },
  ] as LayoutModuleTeasers['shopTeasers'],
  bloggTeasers: [
    { id: 'post-1', title: 'Inlägg', slug: 'inlagg', excerpt: null, coverImageUrl: null },
  ] as LayoutModuleTeasers['bloggTeasers'],
  presentkortReachable: true,
  shopReachable: true,
  bloggReachable: true,
  offertReachable: true,
  lojalitetReachable: true,
  kurserReachable: true,
  galleriReachable: true,
}

function render(theme: StorefrontTheme, modules: LayoutModuleTeasers) {
  const Layout = STOREFRONT_LAYOUTS[theme]
  return renderToStaticMarkup(
    <Layout
      tenant={{ id: 'tenant-1', name: 'Test', slug: 'test' }}
      theme={theme}
      content={resolveThemeContent(theme, null, null)}
      services={[SERVICE]}
      location={null}
      modules={modules}
    />,
  )
}

function moduleHrefs(html: string) {
  const prefixes = ['/boka', '/shop', '/blogg', '/offert', '/presentkort', '/klubb', '/stamkund', '/kurser', '/galleri']
  return [...html.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1] as string)
    .filter((href) => prefixes.some((prefix) => href.startsWith(prefix)))
}

describe.each(STOREFRONT_THEMES)('%s production layout module matrix', (theme) => {
  it.each(['off', 'draft'] as const)('emits no module routes when state is %s', () => {
    expect(moduleHrefs(render(theme, OFF))).toEqual([])
  })

  it.each(['paused', 'live'] as const)('renders safely when reachable modules are %s', () => {
    expect(render(theme, REACHABLE).length).toBeGreaterThan(100)
  })

  it('renders safely with live modules whose required data is empty', () => {
    expect(render(theme, { ...OFF, bookingReachable: true }).length).toBeGreaterThan(100)
  })
})

it('covers every registered production layout exactly once', () => {
  expect(Object.keys(STOREFRONT_LAYOUTS).sort()).toEqual([...STOREFRONT_THEMES].sort())
})
