import type { ComponentType } from 'react'
import type { ThemeContentDefaults, ResolvedThemeContent } from '../../theme-content'
import type { ThemeCaps, ExtraField } from '@/lib/platform/theme-capabilities'
import type { Service, TenantLocation, TenantContact } from '@/lib/tenant-data'
import type {
  ShopData,
  ShopConfig,
  ShopProduct,
  ShopFulfilment,
  ShippingOption,
  ShopPaymentMethod,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { LojalitetConfig, LoyaltyPlan } from '@/lib/storefront/lojalitet/types'
import type { GalleryItem } from '@/lib/storefront/galleri/types'
import type { TeamMember } from '@/lib/storefront/team/types'
import type { TenantBranding } from '@corevo/ui'
import { accentForeground, accentInk, contrastRatio } from '@corevo/ui'

/**
 * FLORIST-SVITEN — 13 mall-syskon (goal-58). Varje mall bor i EN egen fil-trio
 * (<Key>Layout.tsx + <key>.module.css + <key>.theme.ts) och registreras i
 * florist/registry.ts. Ingen mall rör en delad lista: nycklar, paletter, copy,
 * caps och CSS-tokens härleds ur FloristTheme nedan.
 *
 * Modulkontraktet är samma som för alla andra teman: layouten är SYNKRON och tar
 * StorefrontLayoutProps (services + modules-propen). Mallarna i den här sviten
 * ÄGER sina moduler (shop/blogg/presentkort/offert vävs in i layouten) — därav
 * THEME_OWNS_MODULES i layouts/index.ts.
 */
export type FloristPalette = {
  primary: string
  primaryD: string
  bg: string
  surface: string
  fg: string
  fg2: string
  line: string
  accentSoft: string
}

/**
 * Typsnitt som FAKTISKT laddas (next/font i app/layout.tsx) — använd BARA dessa
 * vars i fonts.display/fonts.body. Ett familjenamn som inte laddas faller tyst
 * till Georgia och gör mallen typografiskt identisk med grannen.
 *
 *   var(--font-playfair)    Playfair Display   — klassisk serif med hög kontrast
 *   var(--font-cormorant)   Cormorant Garamond — lätt, elegant garamond
 *   var(--font-dmserif)     DM Serif Display   — tung didone-display
 *   var(--font-marcellus)   Marcellus          — romersk, lugn versal-serif
 *   var(--font-italiana)    Italiana           — smal, modeplansch-display
 *   var(--font-fraunces)    Fraunces           — mjuk, "soft-serif" med karaktär
 *   var(--font-script)      Dancing Script     — handskrivet (wordmark/accenter)
 *   var(--font-jost)        Jost               — geometrisk grotesk
 *   var(--font-inter)       Inter              — neutral UI-grotesk
 *   var(--font-source-sans) Source Sans 3      — humanistisk grotesk
 */
export type FloristFonts = { display: string; body: string }

/**
 * TEMA-PAKET (goal-59). Zivar: "de känns som samma sida om och om igen — bara färgen
 * ändras". Han hade rätt, och det gick att mäta: 11 av 13 mallar återanvände de delade
 * .sf*-sektionerna i hemmets nedre halva, ALLA delade samma nav + footer, och /om,
 * /tjanster, /kontakt var identiska för varenda mall. Variationen satt i heron; sedan
 * föll alla ner i samma skelett.
 *
 * En mall är därför inte längre "en hem-layout" utan ett HELT PAKET som får äga:
 *   • sitt SIDHUVUD  (Nav)     — sidans ansikte; delat ansikte = samma sida
 *   • sin SIDFOT     (Footer)
 *   • sina UNDERSIDOR (om/tjanster/kontakt)
 * Allt är VALFRITT: utelämnas något faller mallen tillbaka på de delade komponenterna,
 * så de sju äldre temana är oförändrade.
 *
 * FUNKTIONEN är fortfarande plattformens: mallens nav-markup renderas som children i
 * NavShell (mobilmeny, fokusfälla, korg, kundkonto, scroll-beteende), och länklistan +
 * huvud-CTA:n är modul-gatade av layouten. Mallen bestämmer FORMEN, aldrig funktionen —
 * annars tappar en ny mall korgen eller mobilmenyn utan att någon märker det.
 */
export type ThemeNavProps = {
  /** Hela tenant-identiteten — <Logo> kräver id+slug (BrandTenant), inte bara namnet. */
  tenant: { id: string; name: string; slug: string }
  branding: TenantBranding
  /** Modulstyrda menylänkar (växer med kundens live-moduler). Rendera ALLA. */
  links: readonly { href: string; label: string }[]
  /** Bransch-styrd huvud-CTA (modul-gatad). null = boknings-drawern (BookCta). */
  primaryCta: { label: string; href: string } | null
  /** Shop live → korg-ikonen MÅSTE renderas (CartNavButton). */
  cartEnabled: boolean
  /** Kundkonton på → login-ikonen renderas. */
  customerAccountsEnabled: boolean
  /** Mallens tunna toppremsa (content.utility). */
  utilityText: string
}

export type ThemeFooterProps = {
  tenant: { id: string; name: string; slug: string }
  tagline: string
  location: TenantLocation | null
  contact: TenantContact
  social: { instagram: string | null; facebook: string | null; tiktok: string | null }
  links: readonly { href: string; label: string }[]
}

/** Undersidorna (/om, /tjanster, /kontakt) — mallens egna, med samma data som de
 *  delade sektionerna får. Utelämnad sida → dagens delade sektioner. */
export type ThemePageProps = {
  tenant: { id: string; name: string; slug: string }
  content: ResolvedThemeContent
  services: Service[]
  location: TenantLocation | null
  contact: TenantContact
}

export type ThemeChrome = {
  Nav?: ComponentType<ThemeNavProps>
  Footer?: ComponentType<ThemeFooterProps>
  /**
   * goal-60: temats Nav ritar sin EGEN annonsrad ur `utilityText`.
   *
   * NavShell renderar annars ALLTID plattformens UtilityBar ovanför navet — och en
   * mall som också ritar sin egen fick då TVÅ staplade remsor (mörk + tema-färgad).
   * Sätt denna till true i exakt de teman vars Nav konsumerar `utilityText`, så
   * hoppar NavShell över sin egen. Mallen äger formen; texten är fortfarande ägarens.
   */
  ownsUtility?: boolean
}

/**
 * MODUL-VYER (goal-59, Zivars vektor-regel).
 *
 *   "mallens vektor är apex för modulens vektor, men komponenten och modulens
 *    funktion är densamma"
 *
 * En modul (webshop, blogg, offert, presentkort, kurser) äger sin FUNKTION: datan,
 * livscykeln (off/draft/live/paused), varukorgen, kassan, formulären, e-posten. Det
 * ändras ALDRIG av en mall — annars skulle en ny mall tyst kunna tappa köpknappen.
 *
 * Men modulens FORM ska vara mallens. Idag renderar /shop, /blogg, /offert och
 * /presentkort EN delad sektion var — samma kort, samma rubrikband, samma rutnät —
 * oavsett mall. Så fort besökaren klickar in i butiken lämnar hen mallens vektor och
 * landar i plattformens. Det är samma fel som det delade navet, ett steg längre in.
 *
 * Därför: modulen laddar sin data och gatar sin livscykel som förut, och lämnar sedan
 * över RENDERINGEN till mallens vy när mallen har en. Ingen vy → dagens delade sektion,
 * byte-identiskt (de sju äldre temana rör vi inte).
 *
 * Vyerna är SYNKRONA presentationskomponenter: all I/O är redan gjord åt dem.
 */
export type ThemeShopViewProps = {
  data: ShopData
  /** Modulen är pausad → katalogen visas läsbar, köp-CTA:erna är stängda. Mallen MÅSTE
   *  respektera detta (annars kan en kund handla i en stängd butik). */
  paused: boolean
  /** Teaser-läge på startsidan: visa max så här många. undefined = modulens egen sida. */
  limit?: number
  /** "Visa hela butiken →" när listan klipps. */
  moreHref?: string
  content: ResolvedThemeContent
  tenantName: string
}

export type ThemeBloggViewProps = {
  posts: BloggPost[]
  limit?: number
  moreHref?: string
  content: ResolvedThemeContent
  tenantName: string
}

/**
 * goal-64 — KÖP-RÄLSENS VYER IN I KONTRAKTET.
 *
 * Produktsidan, varukorgen och kassan var registrerade i tre HÅRDKODADE tabeller inne i
 * route-filerna (PRODUCT_VIEWS/CART_VIEWS/CHECKOUT_VIEWS, goal-62) — bara `calytrix` stod
 * i dem. Följden: en mall ägde sin form överallt UTOM där kunden faktiskt betalar, och en
 * ny mall som ville äga sitt packbord tvingades editera tre route-filer. Nu deklarerar
 * mallen dem i sin egen <key>.theme.ts, precis som shop/blogg.
 *
 * FUNKTIONEN är oförändrad och delad (vektor-regeln): samma loadShopProduct/loadShopData,
 * samma useCart/AddToCart, samma reserve/confirm-FSM, samma modul-gate. Vyerna är
 * SYNKRONA presentationskomponenter — all I/O är redan gjord åt dem. Utelämnad vy →
 * dagens delade sida, byte-identiskt.
 */
export type ThemeProductViewProps = {
  config: ShopConfig
  product: ShopProduct
  /** Butiken är pausad → katalogen läsbar, köp-CTA stängd. Mallen MÅSTE respektera det. */
  paused: boolean
}

/** Varukorgen läser sitt innehåll ur useCart() på klienten — inga props behövs. */
export type ThemeCartViewProps = Record<string, never>

export type ThemeCheckoutViewProps = {
  fulfilment: ShopFulfilment
  /**
   * goal-64 — KASSAN BLIR SANN.
   *
   * Kundens leveransval (shop_shipping_options). ALLA 12 mallar har ett leveranssteg
   * med pris; motorn hade EN fulfilment-variant och shipping_cents = 0, så totalen ljög
   * så fort designen visade en fraktrad. Nu VÄLJER kunden, och priset kommer ur DB.
   *
   * TOM lista = butiken har inte lagt upp några val → mallen ritar inget val-steg och
   * frakten är 0 (oförändrat för alla befintliga butiker). Vyn får ALDRIG hitta på ett
   * alternativ, och aldrig ett pris.
   */
  shippingOptions: ShippingOption[]
  /**
   * Betalsätt som är BÅDE påslagna av kunden OCH har en kopplad räls (Stripe godkänd /
   * PayPal-nycklar satta). Hinttexten till varje sätt hämtas ur SHOP_PAYMENT_METHODS —
   * de står som `verbatim` i alla 12 manifest och är alltså en del av designen.
   *
   * TOM lista = butiken tar inte betalt online → mallen visar "betala vid leverans/
   * upphämtning". Ett betalsätt som inte står här får ALDRIG renderas: hellre färre val
   * än en knapp som ljuger.
   */
  paymentMethods: ShopPaymentMethod[]
}

/**
 * goal-64 — DE TRE SIDOR MALLARNA HADE OCH MOTORN SAKNADE.
 *
 * Kartläggningen av de 12 .dc.html-paketen visade tre sidor som ALLA mallar har i sitt
 * manifest men som plattformen aldrig byggt: klubben (lojalitet), galleriet och teamet.
 * Ateljé Vinters nav länkade redan till /galleri → 404, och Onyx "Kretsen" tvingades
 * rendera olänkad text. Zivar: "inget får gå mista — dessa filer exakt som de är ska
 * kunna vara verkliga i plattformen". Alltså: sidorna byggs, med riktig data (migration
 * 0057), och mallen äger formen precis som för butik och blogg.
 */
export type ThemeLojalitetViewProps = {
  config: LojalitetConfig
  /** Klubbens prisbärande nivåer (loyalty_plans) — Källas Droppe/Källa/Flod. Tom = inga nivåer. */
  plans: LoyaltyPlan[]
  content: ResolvedThemeContent
  tenantName: string
}

export type ThemeGalleriViewProps = {
  items: GalleryItem[]
  content: ResolvedThemeContent
  tenantName: string
}

export type ThemeTeamViewProps = {
  /** Kundens EGEN personal (staff, show_on_site). Tom lista → mallen renderar inget team —
   *  aldrig stock-ansikten presenterade som salongens folk. */
  members: TeamMember[]
  content: ResolvedThemeContent
  tenantName: string
}

export type ThemeModuleViews = {
  shop?: ComponentType<ThemeShopViewProps>
  blogg?: ComponentType<ThemeBloggViewProps>
  /** goal-64: klubben (/klubb). Utelämnad → modulens delade sektion. */
  lojalitet?: ComponentType<ThemeLojalitetViewProps>
  /** goal-64: galleriet (/galleri). */
  galleri?: ComponentType<ThemeGalleriViewProps>
  /** goal-64: teamet (/team). Salong-mallarnas egen nav-punkt. */
  team?: ComponentType<ThemeTeamViewProps>
  /** goal-64: mallens EGEN produktsida (/shop/[id]). Ersätter PRODUCT_VIEWS. */
  product?: ComponentType<ThemeProductViewProps>
  /** goal-64: mallens EGEN varukorg (/varukorg). Ersätter CART_VIEWS. */
  cart?: ComponentType<ThemeCartViewProps>
  /** goal-64: mallens EGEN kassa (/kassa). Ersätter CHECKOUT_VIEWS. */
  checkout?: ComponentType<ThemeCheckoutViewProps>
}

export type ThemePages = {
  om?: ComponentType<ThemePageProps>
  tjanster?: ComponentType<ThemePageProps>
  kontakt?: ComponentType<ThemePageProps>
}

export type FloristTheme = {
  /** Temanyckel = settings.theme-värdet. Måste finnas i STOREFRONT_THEMES. */
  key: string
  /** Visningsnamn i mallväljaren. */
  name: string
  /** En rad i mallväljaren: "Färg · känsla". */
  desc: string
  palette: FloristPalette
  fonts: FloristFonts
  /** --sf-radius (t.ex. '0px' för skarpa hörn, '18px' för mjuka kort). */
  radius: string
  /** --nav-h: höjden det fixerade toppklustret reserverar. Sätt BARA när mallens
   *  sidhuvud är högre än plattformens default (t.ex. Onyx krön + rad = två våningar).
   *  Bor här och INTE i mallens CSS: .shellMain/.tenant-main är globala klasser, och en
   *  ren :global()-regel i en CSS Module är inte "pure" → webpack-fel i produktionsbygget.
   *  [mobil, desktop] — mobilvärdet läggs i en max-width:720px-media. */
  navHeight?: { desktop: string; mobile: string }
  /** Mallens evergreen-copy + fotostandard. ThemeContentDefaults = THEME_CONTENTs
   *  bas-kontrakt + de valfria sektions-texterna (shopEyebrow/blogTitle/giftLede …)
   *  som mallen får ge egna standardvärden för; ägarens settings.copy vinner ändå. */
  content: ThemeContentDefaults
  /** Vilka Sida-fält som är meningsfulla för mallen (super-admins redigering). */
  caps: ThemeCaps
  /**
   * goal-64: ORDERNUMRETS PREFIX — mallens, inte databasens.
   *
   * Bekräftelsen visade en uuid; designen visar "#OX-4821" (onyx), "No. E-1204" (eloria),
   * "N°…" (lunaria). Själva NUMRET är plattformens (shop_orders.order_no, ett per-tenant
   * löpnummer ur 0058) — prefixet är mallens FORM, precis som allt annat en mall äger.
   * Det lagras därför aldrig på ordern: byter kunden mall imorgon ska de gamla ordrarna
   * skrivas i den NYA mallens form, inte frysa den gamlas.
   *
   * Utelämnat → "#" (neutralt). Ordrar lagda före 0058 saknar order_no → bekräftelsen
   * faller tillbaka på id:t, ärligt, i stället för att hitta på ett nummer.
   */
  orderPrefix?: string
  /** Mallens EGET sidhuvud/sidfot. Utelämnat → plattformens delade Nav/Footer. */
  chrome?: ThemeChrome
  /** Mallens EGNA undersidor. Utelämnad sida → de delade sektionerna. */
  pages?: ThemePages
  /** Mallens EGNA modul-vyer (butik/blogg). Modulen äger funktionen och datan; mallen
   *  äger formen. Utelämnad vy → modulens delade sektion, byte-identiskt. */
  moduleViews?: ThemeModuleViews
  /** goal-61 editor-paritet: mallens REDIGERBARA element (Sida-editorns fält).
   *  name = CopyOverride-nyckeln layouten läser via content.<name>; default = layoutens
   *  inbyggda fallback-sträng VERBATIM (fältet ska förifyllas ärligt). Namnprefixen
   *  shop/blog/gift routar fältet till sin modulflik i SidaStudio; övriga hamnar på
   *  Hem-fliken. ÅTERANVÄND befintliga CopyOverride-nycklar — en ny nyckel kräver
   *  trippel-listan i theme-content.ts (typ + whitelist + resolve). */
  extraHome?: ExtraField[]
  /**
   * goal-64: MALLEN ÄGER SIN TEXT — bransch-lagret hoppas över för den här mallen.
   *
   * Utan flaggan är precedensen `kund > bransch > mall` (theme-content.ts → layerCopy):
   * BRANSCH_COPY ligger ovanpå mallens content, så en florist-tenant får branschens
   * generiska hero-text även om mallen har en egen. För en mall som är en EXAKT KOPIA av
   * ett Claude Design-paket är det fel väg — då är designens copy en del av designen, och
   * att tyst byta ut den är samma sak som att improvisera bort mallen.
   *
   * ownsCopy: true → `kund > mall`. Ägarens settings.copy vinner fortfarande (det ÄR
   * redigeraren); bara bransch-nivån tas bort. Utelämnad/false → oförändrat beteende,
   * så de sju äldre temana + flora/freshcut/zentum ligger kvar precis som förut.
   */
  ownsCopy?: boolean
}

/**
 * Ett tema → ett [data-theme]-block, exakt samma form som de handskrivna blocken i
 * packages/ui/tokens.css. Emitteras samlat från app/layout.tsx (FLORIST_THEME_CSS)
 * så alla sex rötter som sätter data-theme får paletten — inklusive bokningsflödet
 * och onboarding-studions preview.
 */
export function floristThemeBlock(t: FloristTheme): string {
  const nav = t.navHeight
    ? `[data-world="storefront"][data-theme="${t.key}"]{--nav-h:${t.navHeight.desktop};}` +
      `@media(max-width:720px){[data-world="storefront"][data-theme="${t.key}"]{--nav-h:${t.navHeight.mobile};}}`
    : ''
  // goal-62 B2a: accenten ÄR mallens primary på storefronten (tokens.css), men
  // --color-accent-fg låg kvar som ett globalt #ffffff — vit text på en LJUS accent
  // (onyx korall: 2.83:1, mätt). Textfärgen räknas nu ur mallens egen primary:
  // den av ink/vit som ger högst WCAG-kontrast vinner. Ingen mall kan längre ärva
  // en knapptext som inte syns.
  const accentFg = accentForeground(t.palette.primary) ?? '#ffffff'
  // goal-62 B2b: TEXTSÄKER syskonton. Eyebrows, priser och sifferled läser den här i
  // stället för --color-primary, som är gjord för att BÄRA en yta.
  // Värsta fallet för mörk text är den MÖRKASTE av mallens ljusa ytor (nästan alltid
  // accent-soft, inte den vita) — mäts den mot den vita blir tonen för ljus och texten
  // faller igenom på tonade sektioner. Mörka mallar (onyx) har ingen ljus yta → primary
  // står orörd, den ligger redan på mörkt.
  const lightSurfaces = [t.palette.bg, t.palette.surface, t.palette.accentSoft].filter(
    (c) => accentForeground(c) === '#15281f',
  )
  const worstLight = lightSurfaces.sort(
    (a, b) => (contrastRatio('#000000', a) ?? 0) - (contrastRatio('#000000', b) ?? 0),
  )[0]
  const ink = (worstLight ? accentInk(t.palette.primary, worstLight) : null) ?? t.palette.primary
  return nav + `[data-world="storefront"][data-theme="${t.key}"]{--color-primary:${t.palette.primary};--color-primary-d:${t.palette.primaryD};--color-bg:${t.palette.bg};--color-surface:${t.palette.surface};--color-fg:${t.palette.fg};--color-fg-2:${t.palette.fg2};--color-line:${t.palette.line};--color-accent-soft:${t.palette.accentSoft};--color-accent-fg:${accentFg};--color-primary-fg:${accentFg};--color-primary-ink:${ink};--font-display:${t.fonts.display};--font-body:${t.fonts.body};--sf-radius:${t.radius};}`
}
