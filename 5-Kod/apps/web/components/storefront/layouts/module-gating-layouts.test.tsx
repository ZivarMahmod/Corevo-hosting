import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))

import type { StorefrontTheme } from '@/lib/tenant-data'
import { resolveThemeContent } from '../theme-content'
import { EditLayout } from './EditLayout'
import { FloraLayout } from './FloraLayout'
import { LeanderLayout } from './LeanderLayout'
import { LinneaLayout } from './LinneaLayout'
import { SalviaLayout } from './SalviaLayout'
import { ZiggeLayout } from './ZiggeLayout'
import type { LayoutModuleTeasers, StorefrontLayoutProps } from './types'

const THEMES = [
  ['flora', FloraLayout],
  ['salvia', SalviaLayout],
  ['leander', LeanderLayout],
  ['zigge', ZiggeLayout],
  ['linnea', LinneaLayout],
  ['edit', EditLayout],
] as const

const OFF: LayoutModuleTeasers = {
  shopTeasers: [],
  bloggTeasers: [],
  bookingReachable: false,
  presentkortReachable: false,
  shopReachable: false,
  bloggReachable: false,
  offertReachable: false,
  lojalitetReachable: false,
  kurserReachable: false,
  galleriReachable: false,
}

const PAUSED_WITH_DATA: LayoutModuleTeasers = {
  ...OFF,
  shopTeasers: [
    { id: 'product-1', name: 'Bukett', priceCents: 39900, currency: 'SEK', imageUrl: null },
  ] as LayoutModuleTeasers['shopTeasers'],
  presentkortReachable: true,
  shopReachable: true,
  bloggReachable: false,
  offertReachable: true,
  lojalitetReachable: true,
  kurserReachable: true,
  galleriReachable: true,
}

function render(theme: StorefrontTheme, Layout: (props: StorefrontLayoutProps) => React.ReactNode, modules?: LayoutModuleTeasers) {
  return renderToStaticMarkup(
    <Layout
      tenant={{ id: 'tenant-1', name: 'Test', slug: 'test' }}
      theme={theme}
      content={resolveThemeContent(theme, null, null)}
      services={[]}
      location={null}
      modules={modules}
    />,
  )
}

function hrefs(html: string) {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] as string)
}

describe.each(THEMES)('%s module reachability', (theme, Layout) => {
  it('does not emit links for disabled or empty target modules', () => {
    const links = hrefs(render(theme, Layout, OFF))
    for (const path of ['/shop', '/offert', '/presentkort', '/klubb', '/stamkund', '/kurser', '/galleri', '/blogg']) {
      expect(links.filter((href) => href.startsWith(path))).toEqual([])
    }
  })

  it('fails closed when a caller omits module reachability', () => {
    const links = hrefs(render(theme, Layout))
    for (const path of ['/shop', '/offert', '/presentkort', '/klubb', '/stamkund', '/kurser', '/galleri', '/blogg']) {
      expect(links.filter((href) => href.startsWith(path))).toEqual([])
    }
  })

  it('keeps paused module pages reachable when their required data exists', () => {
    const links = hrefs(render(theme, Layout, PAUSED_WITH_DATA))
    expect(links.some((href) => href.startsWith('/shop'))).toBe(true)
    expect(links).toContain('/presentkort')
  })
})
