// goal-58 — FLORIST-SVITEN (13 mallar): mekanisk render-verify av HELA sviten.
// Bevisar per mall: (1) den renderar synkront utan att kasta, (2) hero-rubriken kommer
// ur mallens egen copy, (3) modul-gatingen håller — en avstängd modul ger INGEN länk
// till sin sida (404-fällan), en live modul ger teasers, (4) services=[] kraschar inte,
// (5) mallen är registrerad i ALLA ytor (layout, palett, caps, tokens-CSS, ägar-setet).
// node env + renderToStaticMarkup (ingen DOM). Bookable → useRouter → mockas.
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))

import type { StorefrontTheme, Service, TenantLocation } from '@/lib/tenant-data'
import { STOREFRONT_THEMES } from '@/lib/tenant-data'
import { STOREFRONT_LAYOUTS, THEME_OWNS_MODULES } from '../index'
import { resolveThemeContent } from '../../theme-content'
import { THEME_PALETTES } from '@/lib/platform/theme-palettes'
import { THEME_CAPS } from '@/lib/platform/theme-capabilities'
import { FLORIST_THEMES, FLORIST_THEME_CSS } from './registry'
import type { LayoutModuleTeasers } from '../types'

const TENANT = { id: 't1', name: 'Blomsterhandeln', slug: 'blomster' }
const LOCATION: TenantLocation = {
  id: 'l1',
  name: 'Butiken',
  address: 'Storgatan 1, Linköping',
  hours: [{ day: 'Mån–Fre', time: '10–18' }],
} as unknown as TenantLocation
const SERVICES: Service[] = [
  { id: 's1', name: 'Handbunden bukett', price_cents: 45000, duration_min: 30, description: 'Säsong' },
  { id: 's2', name: 'Brudbukett', price_cents: 190000, duration_min: 60, description: null },
] as unknown as Service[]

const ALL_LIVE: LayoutModuleTeasers = {
  shopTeasers: [
    { id: 'p1', name: 'Vårbukett', priceCents: 39900, currency: 'SEK', imageUrl: null },
    { id: 'p2', name: 'Pioner', priceCents: 49900, currency: 'SEK', imageUrl: null },
  ] as unknown as LayoutModuleTeasers['shopTeasers'],
  bloggTeasers: [
    { id: 'b1', title: 'Säsongens blommor', slug: 'sasong', excerpt: 'Vad som blommar nu', coverImageUrl: null },
  ] as unknown as LayoutModuleTeasers['bloggTeasers'],
  presentkortLive: true,
  shopReachable: true,
  offertReachable: true,
}
const ALL_OFF: LayoutModuleTeasers = {
  shopTeasers: [],
  bloggTeasers: [],
  presentkortLive: false,
  shopReachable: false,
  offertReachable: false,
}

function render(key: string, modules: LayoutModuleTeasers | undefined, services: Service[] = SERVICES) {
  const theme = key as StorefrontTheme
  const Layout = STOREFRONT_LAYOUTS[theme]
  return renderToStaticMarkup(
    <Layout
      tenant={TENANT}
      theme={theme}
      content={resolveThemeContent(theme, null, null)}
      services={services}
      location={LOCATION}
      modules={modules}
    />,
  )
}

/**
 * HELA PAKETET (goal-64): hemmet + mallens sidfot. En mall MÅSTE göra sina live-moduler
 * nåbara — men den får själv välja VAR. De flesta väver in dem som band på hemmet;
 * Ateljé Vinter (galleri-minimal) har medvetet inga band alls och lägger länkarna i nav
 * och sidfot i stället, precis som dess Claude Design-fil gör. Renderade vi bara layouten
 * skulle testet tvinga fram ett presentkortsband i en mall vars fil inte har något — dvs.
 * kräva att vi improviserar bort designen. Kravet är REACHABILITY, inte ett visst band.
 *
 * `links` är samma modul-gatade lista som app/(public)/layout.tsx skickar in: en avstängd
 * modul finns inte i den, så 404-fällan fångas fortfarande — nu på paketnivå.
 */
function renderPackage(key: string, modules: LayoutModuleTeasers, services: Service[] = SERVICES) {
  const theme = key as StorefrontTheme
  const def = FLORIST_THEMES.find((t) => t.key === key)
  const Footer = def?.chrome?.Footer
  const links = [
    ...(modules.shopReachable ? [{ href: '/shop', label: 'Butik' }] : []),
    ...(modules.bloggTeasers.length > 0 ? [{ href: '/blogg', label: 'Blogg' }] : []),
    ...(modules.presentkortLive ? [{ href: '/presentkort', label: 'Presentkort' }] : []),
    ...(modules.offertReachable ? [{ href: '/offert', label: 'Offert' }] : []),
  ]
  const foot = Footer
    ? renderToStaticMarkup(
        <Footer
          tenant={TENANT}
          tagline="Tagline"
          location={LOCATION}
          contact={{ email: null, phone: null }}
          social={{ instagram: null, facebook: null, tiktok: null }}
          links={links}
        />,
      )
    : ''
  return render(key, modules, services) + foot
}

/** Länkar (href) i markupen — attributmatchning, aldrig body-grep. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] as string)
}

describe.each(FLORIST_THEMES.map((t) => [t.key, t.name, t] as const))(
  'florist-mall: %s',
  (key, name, theme) => {
    it('är registrerad i alla ytor (layout, nyckel, palett, caps, tokens-CSS, modul-ägarskap)', () => {
      expect(STOREFRONT_THEMES).toContain(key)
      expect(STOREFRONT_LAYOUTS[key as StorefrontTheme]).toBeTypeOf('function')
      expect(THEME_PALETTES.some((p) => p.key === key)).toBe(true)
      expect(THEME_CAPS[key]).toBeDefined()
      expect(THEME_OWNS_MODULES.has(key as StorefrontTheme)).toBe(true)
      expect(FLORIST_THEME_CSS).toContain(`[data-world="storefront"][data-theme="${key}"]`)
    })

    it('renderar synkront med mallens egen hero-copy', () => {
      const html = render(key, ALL_LIVE)
      // Hero-rubriken kan brytas över rader (\n) → testa första ordet-frasen.
      const firstLine = (theme.content.heroTitle.split('\n')[0] as string).trim()
      expect(html).toContain(firstLine)
      expect(html.length).toBeGreaterThan(2000)
    })

    it('gör live-moduler NÅBARA (shop, blogg, presentkort — i hemmet eller i sidfoten)', () => {
      const links = hrefs(renderPackage(key, ALL_LIVE))
      expect(links.some((h) => h.startsWith('/shop'))).toBe(true)
      expect(links.some((h) => h.startsWith('/blogg'))).toBe(true)
      expect(links.some((h) => h.startsWith('/presentkort'))).toBe(true)
    })

    it('avstängda moduler ger INGA länkar till sina sidor (404-fällan)', () => {
      const links = hrefs(renderPackage(key, ALL_OFF))
      expect(links.filter((h) => h.startsWith('/shop'))).toEqual([])
      expect(links.filter((h) => h.startsWith('/offert'))).toEqual([])
      expect(links.filter((h) => h.startsWith('/blogg'))).toEqual([])
      expect(links.filter((h) => h.startsWith('/presentkort'))).toEqual([])
    })

    it('utan modules-prop (studions preview) renderar mallen ändå', () => {
      expect(render(key, undefined)).toContain('</section>')
    })

    it('services=[] kraschar inte och hittar inte på tjänster', () => {
      const html = render(key, ALL_LIVE, [])
      expect(html).not.toContain('Handbunden bukett')
      expect(html.length).toBeGreaterThan(1000)
    })

    it('caps stämmer med vad mallen FAKTISKT renderar (statistik-trion)', () => {
      const html = render(key, ALL_LIVE)
      const statLabel = theme.content.stats[0]?.[1]
      if (theme.caps.homeStats && statLabel) expect(html).toContain(statLabel)
    })

    it(`${name}: typsnitten är laddade familjer (var(--font-*)), inte tysta fallbacks`, () => {
      expect(theme.fonts.display).toMatch(/var\(--font-[a-z-]+\)/)
      expect(theme.fonts.body).toMatch(/var\(--font-[a-z-]+\)/)
    })
  },
)

describe('florist-sviten som helhet', () => {
  it('unika nycklar — ingen mall skuggar en annan', () => {
    expect(FLORIST_THEMES.length).toBeGreaterThan(0)
    expect(new Set(FLORIST_THEMES.map((t) => t.key)).size).toBe(FLORIST_THEMES.length)
  })

  it('ingen mall delar palett med en annan (de ska INTE se likadana ut)', () => {
    const primaries = FLORIST_THEMES.map((t) => t.palette.primary.toLowerCase())
    expect(new Set(primaries).size).toBe(FLORIST_THEMES.length)
  })
})
