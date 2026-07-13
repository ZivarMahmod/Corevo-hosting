// goal-59 — MODUL-VYERNA: mallen äger formen, MODULEN äger funktionen.
//
// Vektor-regeln (Zivar): "mallens vektor är apex för modulens vektor, men modulens
// funktion är densamma". En mall får rita butiken hur den vill — men den får ALDRIG
// kunna sälja ur en stängd butik, tappa köpknappen, hitta på priser eller länka till
// ett blogginlägg som inte finns. Det här är kontraktet, mekaniskt låst för alla 13
// (och för varje mall som tillkommer: den faller in i describe.each automatiskt).
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))

import { FLORIST_THEMES } from './registry'
import type { ResolvedThemeContent } from '../../theme-content'
import { CartProvider } from '../../shop/CartProvider'
import type { ShopData } from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'

// Riktiga varianter: AddToCart är variant-medveten (en produkt utan köpbar variant
// renderas ärligt otillgänglig — available: null = ospårat lager, alltså köpbart).
const PRODUCTS = [
  {
    id: 'p1', name: 'Vårbukett', priceCents: 39900, currency: 'SEK', imageUrl: null,
    variants: [{ id: 'v1', name: 'Standard', priceCents: 39900, available: null }],
    category: 'Buketter', badge: null, compareAtPriceCents: null, priceFrom: false,
  },
  {
    id: 'p2', name: 'Pioner i vas', priceCents: 64900, currency: 'SEK', imageUrl: null,
    variants: [{ id: 'v2', name: 'Standard', priceCents: 64900, available: null }],
    category: 'Säsong', badge: null, compareAtPriceCents: null, priceFrom: false,
  },
] as unknown as ShopData['products']

// goal-64: en kund UTAN kategorier är normalfallet (fälten är valfria) — därför bär bas-DATA
// en TOM kategorilista, och testerna nedan bevisar att ingen mall då ritar en chip-rad.
const DATA: ShopData = {
  config: { fulfilment: 'ship' },
  products: PRODUCTS,
  categories: [],
  activeCategory: null,
} as unknown as ShopData

const POSTS: BloggPost[] = [
  { id: 'b1', title: 'Säsongens blommor', slug: 'sasong', excerpt: 'Vad som blommar nu', coverImageUrl: null, publishedAt: '2026-05-01' },
  // Inlägg UTAN slug (äldre rader) — får inte länkas någonstans (skulle bli 404).
  { id: 'b2', title: 'Utan slug', slug: null, excerpt: null, coverImageUrl: null, publishedAt: '2026-04-01' },
] as unknown as BloggPost[]

const WITH_VIEWS = FLORIST_THEMES.filter((t) => t.moduleViews?.shop && t.moduleViews?.blogg)

describe('florist-svitens modul-vyer', () => {
  it('VARJE mall i sviten äger både butiks- och bloggvyn', () => {
    expect(WITH_VIEWS).toHaveLength(FLORIST_THEMES.length)
  })

  /**
   * goal-64: de fyra florist-mallar vars .dc.html RITAR en kategori-filterrad MÅSTE rendera
   * den när kunden har kategorier. Utan det här testet kunde en refaktor tyst tappa chipsen
   * igen — precis som agenterna en gång utelämnade dem ("plattformen har ingen kategorimodell").
   */
  it.each(['calytrix', 'solsalt', 'sivsav', 'lunaria'])(
    '%s renderar kategori-chipsen när kunden har kategorier',
    (key) => {
      const theme = FLORIST_THEMES.find((t) => t.key === key)!
      const Shop = theme.moduleViews!.shop!
      const content = { ...theme.content, aboutCopyHome: theme.content.aboutCopy } as ResolvedThemeContent
      const html = renderToStaticMarkup(
        <CartProvider>
          <Shop
            data={{ ...DATA, categories: ['Buketter', 'Säsong'] } as ShopData}
            paused={false}
            content={content}
            tenantName="Blomsterhandeln"
          />
        </CartProvider>,
      )
      expect(html).toContain('?kategori=Buketter')
    },
  )
})

describe.each(WITH_VIEWS.map((t) => [t.key, t] as const))('modul-vy: %s', (_key, theme) => {
  // Mallens egen evergreen-copy (resolveThemeContent går inte att kalla här: registryt
  // och theme-content importerar varandra, så THEME_CONTENT är tom vid modul-init i
  // testmiljön). Vyerna läser bara copy-fälten, som alla finns i theme.content.
  const content = {
    ...theme.content,
    aboutCopyHome: theme.content.aboutCopy,
  } as ResolvedThemeContent
  const Shop = theme.moduleViews!.shop!
  const Blogg = theme.moduleViews!.blogg!

  // CartProvider omsluter storefrontens hela skal i verkligheten (app/(public)/layout.tsx)
  // — AddToCart (modulens klientkomponent) läser varukorgen därifrån.
  const shopHtml = (paused: boolean, data: ShopData = DATA) =>
    renderToStaticMarkup(
      <CartProvider>
        <Shop data={data} paused={paused} content={content} tenantName="Blomsterhandeln" />
      </CartProvider>,
    )

  it('öppen butik: köpknappen finns för varje produkt', () => {
    const html = shopHtml(false)
    expect(html).toContain('Vårbukett')
    expect(html).toContain('Pioner i vas')
    // AddToCart renderar en submit-knapp per produkt (modulens egen klientkomponent).
    expect(html.match(/<button/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('PAUSAD butik: går INTE att handla i — noll köpknappar, men katalogen syns', () => {
    const html = shopHtml(true)
    // Katalogen ska fortfarande gå att läsa (kunden får se sortimentet)…
    expect(html).toContain('Vårbukett')
    // …men ingen köpknapp får finnas kvar, och stängt-läget måste annonseras.
    expect(html).not.toMatch(/<button[^>]*>[^<]*(Lägg i|Reservera|Beställ till butik)/i)
    expect(html).toContain('role="status"')
  })

  it('priserna kommer från modulen (formatShopPrice), aldrig från mallen', () => {
    // 39900 öre → "399 kr" (formatShopPrice). En mall som formaterar själv skulle
    // förr eller senare visa fel pris — det är modulens sanning, inte mallens.
    expect(shopHtml(false)).toContain('399')
  })

  it('tomt sortiment på modulens egen sida → ärlig text, aldrig påhittade produkter', () => {
    const empty = { ...DATA, products: [] } as ShopData
    const html = shopHtml(false, empty)
    expect(html).not.toContain('Vårbukett')
    expect(html.length).toBeGreaterThan(200) // en riktig sida, inte ett tomt skal
  })

  /* ─────────────── goal-64: kategori · badge · prisrörelse · "från"-pris ─────────────── */

  it('TOM kategorilista → INGEN mall renderar en chip-rad (aldrig en påhittad kategori)', () => {
    // Bas-DATA har categories: [] — de flesta kunder sätter aldrig en kategori.
    const html = shopHtml(false)
    expect(html).not.toContain('?kategori=')
  })

  it('kunden HAR kategorier → chipsen renderas som LÄNKAR (server-side filter, funkar utan JS)', () => {
    const withCats = { ...DATA, categories: ['Buketter', 'Säsong'] } as ShopData
    const html = shopHtml(false, withCats)
    // Bara de mallar vars .dc.html RITAR en filterrad har chips (calytrix/solsalt/sivsav/
    // lunaria). Övriga ska inte hitta på en — men den som HAR dem måste ha dem rätt.
    if (html.includes('?kategori=')) {
      expect(html).toContain('?kategori=Buketter')
      expect(html).toContain('?kategori=S%C3%A4song') // encodeURIComponent — ä överlever länken
      expect(html).toContain('href="/shop"') // "Alla/Allt"-chipen leder tillbaka till allt
    }
  })

  it('okänd kategori i query → tom lista, ingen krasch (loadern filtrerar bort allt)', () => {
    // Så här ser ShopData ut när /shop?kategori=Finnsinte träffar loadern.
    const unknown = {
      ...DATA,
      products: [],
      categories: ['Buketter', 'Säsong'],
      activeCategory: 'Finnsinte',
    } as ShopData
    const html = shopHtml(false, unknown)
    expect(html).not.toContain('Vårbukett')
    expect(html.length).toBeGreaterThan(200) // en riktig sida, inte ett tomt skal
    // Har mallen en chip-rad står den KVAR — annars kunde besökaren inte ta sig tillbaka.
    if (html.includes('?kategori=')) expect(html).toContain('?kategori=Buketter')
  })

  it('badge renderas bara när produkten bär den (render-on-present)', () => {
    const noBadge = shopHtml(false)
    expect(noBadge).not.toContain('Bästsäljare')

    const badged = {
      ...DATA,
      products: [{ ...PRODUCTS[0], badge: 'Bästsäljare' }],
    } as unknown as ShopData
    const html = shopHtml(false, badged)
    // Bara de mallar vars .dc.html RITAR ett märke visar det — de andra ska inte krascha.
    expect(html).toContain('Vårbukett')
  })

  it('priceFrom → priset skrivs "fr. " (formatProductPrice, aldrig mallens egen formatering)', () => {
    const from = {
      ...DATA,
      products: [{ ...PRODUCTS[0], priceFrom: true }],
    } as unknown as ShopData
    expect(shopHtml(false, from)).toContain('fr. 399')
    // …och utan flaggan står priset naket.
    expect(shopHtml(false)).not.toContain('fr. 399')
  })

  it('bloggen länkar inlägg med slug — och lämnar inlägg UTAN slug olänkade (ingen 404-fälla)', () => {
    const html = renderToStaticMarkup(
      <Blogg posts={POSTS} content={content} tenantName="Blomsterhandeln" />,
    )
    expect(html).toContain('/blogg/sasong')
    expect(html).toContain('Utan slug')
    expect(html).not.toContain('/blogg/null')
    expect(html).not.toContain('href="/blogg/undefined"')
  })
})
