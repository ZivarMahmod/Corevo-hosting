import type { ComponentType } from 'react'
import type { ThemeContentDefaults, ResolvedThemeContent } from '../../theme-content'
import type { ThemeCaps } from '@/lib/platform/theme-capabilities'
import type { Service, TenantLocation, TenantContact } from '@/lib/tenant-data'
import type { TenantBranding } from '@corevo/ui'

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
  tenant: { name: string }
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
  tenant: { name: string }
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
  /** Mallens evergreen-copy + fotostandard. ThemeContentDefaults = THEME_CONTENTs
   *  bas-kontrakt + de valfria sektions-texterna (shopEyebrow/blogTitle/giftLede …)
   *  som mallen får ge egna standardvärden för; ägarens settings.copy vinner ändå. */
  content: ThemeContentDefaults
  /** Vilka Sida-fält som är meningsfulla för mallen (super-admins redigering). */
  caps: ThemeCaps
  /** Mallens EGET sidhuvud/sidfot. Utelämnat → plattformens delade Nav/Footer. */
  chrome?: ThemeChrome
  /** Mallens EGNA undersidor. Utelämnad sida → de delade sektionerna. */
  pages?: ThemePages
}

/**
 * Ett tema → ett [data-theme]-block, exakt samma form som de handskrivna blocken i
 * packages/ui/tokens.css. Emitteras samlat från app/layout.tsx (FLORIST_THEME_CSS)
 * så alla sex rötter som sätter data-theme får paletten — inklusive bokningsflödet
 * och onboarding-studions preview.
 */
export function floristThemeBlock(t: FloristTheme): string {
  return `[data-world="storefront"][data-theme="${t.key}"]{--color-primary:${t.palette.primary};--color-primary-d:${t.palette.primaryD};--color-bg:${t.palette.bg};--color-surface:${t.palette.surface};--color-fg:${t.palette.fg};--color-fg-2:${t.palette.fg2};--color-line:${t.palette.line};--color-accent-soft:${t.palette.accentSoft};--font-display:${t.fonts.display};--font-body:${t.fonts.body};--sf-radius:${t.radius};}`
}
