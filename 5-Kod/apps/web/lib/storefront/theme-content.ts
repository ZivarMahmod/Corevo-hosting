// Generiska tema-defaults används bara när ägaren saknar egen copy eller media.

import type { TenantBranding } from '@corevo/ui'
import { withoutLegacySnittStats } from '@/lib/branding/legacy-stats'
import type { StorefrontTheme } from '@/lib/tenant-data'
import { cleanCopyOverride, type CopyOverride } from '@/lib/storefront/theme-copy'
import type {
  ResolvedThemeContent,
  ThemeContent,
  ThemeContentDefaults,
} from './theme-content.types'
import { FLORA_IMAGE_MANIFEST, SALON_IMAGE_MANIFEST } from './images'
import { THEME_DEFINITIONS } from './themes/registry'
import { unsplashPhoto } from './themes/types'

// Varje äldre tema har ett eget verifierbart bildmanifest.
const SALVIA_IMG = {
  hero1: unsplashPhoto('1695527081728-e3a42f0ce261'),
  hero2: unsplashPhoto('1695527081793-91a2d4b5b103'),
  hero3: unsplashPhoto('1781450090585-1a511b7066d9'),
  about: unsplashPhoto('1695527081874-b674c46f40fb'),
  closing: unsplashPhoto('1626383137804-ff908d2753a2'),
  g1: unsplashPhoto('1626379501846-0df4067b8bb9', 900),
  g2: unsplashPhoto('1600948836101-f9ffda59d250', 900),
  g3: unsplashPhoto('1695527081848-1e46c06e6458', 900),
  g4: unsplashPhoto('1746723378067-83a345ff3160', 900),
  g5: unsplashPhoto('1695527081827-fdbc4e77be9b', 900),
  g6: unsplashPhoto('1746723391801-1a24f7a57730', 900),
} as const
const LEANDER_IMG = {
  hero1: unsplashPhoto('1712178435871-48d630f15969'),
  hero2: unsplashPhoto('1716203499461-5a1edb4b5e06'),
  hero3: unsplashPhoto('1711349172547-3246a21a4c0d'),
  about: unsplashPhoto('1725021119504-2cb1e9e4c082'),
  closing: unsplashPhoto('1597010107510-5f74525a5297'),
  g1: unsplashPhoto('1627716762987-d22098e86b3f', 900),
  g2: unsplashPhoto('1642775589620-ca13d73e00a6', 900),
  g3: unsplashPhoto('1694208115105-fec57298ea42', 900),
  g4: unsplashPhoto('1656231586368-3b6dc842a876', 900),
  g5: unsplashPhoto('1528756514091-dee5ecaa3278', 900),
  g6: unsplashPhoto('1640905423713-e8acfb33724e', 900),
} as const
const ZIGGE_IMG = {
  hero1: unsplashPhoto('1779524477261-12141ccbd8d9'),
  hero2: unsplashPhoto('1778409762668-cf893875d611'),
  hero3: unsplashPhoto('1708166210391-6822d91d2895'),
  about: unsplashPhoto('1781931298124-88833761114f'),
  closing: unsplashPhoto('1695632918735-c78986bf3b39'),
  g1: unsplashPhoto('1781226968695-9ce2d4c0271b', 900),
  g2: unsplashPhoto('1769734416095-30fbc03e7bb7', 900),
  g3: unsplashPhoto('1778784544843-712029254a98', 900),
  g4: unsplashPhoto('1775126454577-4846f3e55cc5', 900),
  g5: unsplashPhoto('1779556507342-7951f64a3b86', 900),
  g6: unsplashPhoto('1763081756934-ea920762e6ad', 900),
} as const
const LINNEA_IMG = {
  hero1: unsplashPhoto('1505576391880-b3f9d713dc4f'),
  hero2: unsplashPhoto('1646054346214-2c20bc25b86f'),
  hero3: unsplashPhoto('1762755647813-017e128a4ba0'),
  about: unsplashPhoto('1776211961209-468d71038aa1'),
  closing: unsplashPhoto('1776211961018-f15d43aefe9e'),
  g1: unsplashPhoto('1775769383410-06e6823e3afb', 900),
  g2: unsplashPhoto('1776211961042-500a2459caa0', 900),
  g3: unsplashPhoto('1733896781401-9518c71f7c72', 900),
  g4: unsplashPhoto('1748351970583-327f50884b5d', 900),
  g5: unsplashPhoto('1690397814893-b4c29217eb5b', 900),
  g6: unsplashPhoto('1768152859365-337f962fe1e3', 900),
} as const
const EDIT_IMG = {
  hero1: unsplashPhoto('1599332069800-fcf11ed035ff'),
  hero2: unsplashPhoto('1644978448908-fc907d2495b2'),
  hero3: unsplashPhoto('1662039352486-aeca40b40c39'),
  about: unsplashPhoto('1781925856343-c97d0d44f94c'),
  closing: unsplashPhoto('1596232168371-e4d32dd0aee3'),
  g1: unsplashPhoto('1616105996583-f9e3c00bb31f', 900),
  g2: unsplashPhoto('1510032518699-36e55fe15658', 900),
  g3: unsplashPhoto('1781455589910-d5bd2132d3dc', 900),
  g4: unsplashPhoto('1715407754988-4d617cdf0a4e', 900),
  g5: unsplashPhoto('1540163558217-3aa12d20edf6', 900),
  g6: unsplashPhoto('1700868329999-056910348977', 900),
} as const

// Flora-temats generiska blomster-foton (Unsplash, verifierade 200 OK 2026-07-11).

const STATIC_THEME_CONTENT = {
  salvia: {
    heroEyebrow: '— Välkommen in',
    heroTitle: 'Varsamt utfört.\nSkönt mottagen.',
    heroLede: 'En stilla plats där varje besök får ta sin tid. Boka en stund som är helt din.',
    tagline: 'Omsorg med lugn hand',
    utility: 'Boka online dygnet runt · Välkommen in',
    italic: 'Varje besök är en stund för sig själv.',
    aboutCopy:
      'Hos oss ska ett besök kännas som en paus, inte ett ärende. Vi är ett litet team som bryr oss om hantverket och om dig som kliver in genom dörren.',
    servicesEyebrow: '— Utbud & priser',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Hantverk, kvalitet och personlig service',
    teamEyebrow: '— Vårt team',
    teamTitle: 'Människorna bakom hantverket',
    heroImages: [SALVIA_IMG.hero1, SALVIA_IMG.hero2, SALVIA_IMG.hero3],
    galleryImages: [
      SALVIA_IMG.g1,
      SALVIA_IMG.g2,
      SALVIA_IMG.g3,
      SALVIA_IMG.g4,
      SALVIA_IMG.g5,
      SALVIA_IMG.g6,
    ],
    aboutImage: SALVIA_IMG.about,
    closingImage: SALVIA_IMG.closing,
    team: [
      { name: 'Vårt team', role: 'Hantverk & omsorg', img: SALON_IMAGE_MANIFEST.p1 },
      { name: 'Erfarenhet', role: 'Specialister', img: SALON_IMAGE_MANIFEST.p3 },
      { name: 'Omtanke', role: 'Personlig service', img: SALON_IMAGE_MANIFEST.p5 },
    ],
    stats: [
      ['100%', 'hantverk'],
      ['Lugn', 'takt'],
      ['Personlig', 'service'],
    ],
  },
  leander: {
    heroEyebrow: '— Ateljé & omsorg',
    heroTitle: 'Din stund\ni lugn och ro',
    heroLede:
      'En varm ateljé för hantverk, känsla och omsorg. Vi tar emot dig som en gäst, inte ett bokningsnummer.',
    tagline: 'Hantverk, känsla och omsorg',
    utility: 'Fri konsultation inför besöket · Välkommen in',
    italic: 'Allt vackert börjar med ett samtal.',
    aboutCopy:
      'Hos oss möts hantverk och värme. Vi arbetar med skandinavisk enkelhet och en lugn, personlig ton — för att du ska gå härifrån som mest lik dig själv.',
    servicesEyebrow: '— Vårt utbud',
    servicesTitle: 'Tjänster & priser',
    aboutTitle: 'Hantverk och värme i varje besök',
    teamEyebrow: '— Vårt team',
    teamTitle: 'Människorna i ateljén',
    heroImages: [LEANDER_IMG.hero1, LEANDER_IMG.hero2, LEANDER_IMG.hero3],
    galleryImages: [
      LEANDER_IMG.g1,
      LEANDER_IMG.g2,
      LEANDER_IMG.g3,
      LEANDER_IMG.g4,
      LEANDER_IMG.g5,
      LEANDER_IMG.g6,
    ],
    aboutImage: LEANDER_IMG.about,
    closingImage: LEANDER_IMG.closing,
    team: [
      { name: 'Ateljén', role: 'Hantverk & detaljer', img: SALON_IMAGE_MANIFEST.p2 },
      { name: 'Erfarenhet', role: 'Form & finish', img: SALON_IMAGE_MANIFEST.p4 },
      { name: 'Omsorg', role: 'Personlig ton', img: SALON_IMAGE_MANIFEST.p1 },
    ],
    stats: [
      ['Erfarna', 'specialister'],
      ['Lugn', 'ateljé'],
      ['Personlig', 'omsorg'],
    ],
  },
  zigge: {
    heroEyebrow: '— Drop in & boka online',
    heroTitle: 'RAKT PÅ SAK.\nINGEN KRÅNGEL.',
    heroLede:
      'Snabbt, enkelt och prisvärt för alla. Drop in eller boka online — du får hjälp samma dag.',
    tagline: 'Rakt, enkelt och prisvärt',
    utility: 'Drop in eller boka online · Öppet alla dagar',
    italic: 'Av hantverkare, för alla.',
    aboutCopy:
      'Stället på hörnet där hantverk möter vardag. Vi håller det enkelt, vasst och prisvärt — och vi minns hur du gillar det.',
    servicesEyebrow: '— Utbud & priser',
    servicesTitle: 'TJÄNSTER',
    aboutTitle: 'RENT HANTVERK, INGEN KRÅNGEL',
    teamEyebrow: '— Teamet',
    teamTitle: 'KILLARNA & TJEJERNA SOM FIXAR DET',
    heroImages: [ZIGGE_IMG.hero1, ZIGGE_IMG.hero2, ZIGGE_IMG.hero3],
    galleryImages: [
      ZIGGE_IMG.g1,
      ZIGGE_IMG.g2,
      ZIGGE_IMG.g3,
      ZIGGE_IMG.g4,
      ZIGGE_IMG.g5,
      ZIGGE_IMG.g6,
    ],
    aboutImage: ZIGGE_IMG.about,
    closingImage: ZIGGE_IMG.closing,
    team: [
      { name: 'Teamet', role: 'Snabbt & vasst', img: SALON_IMAGE_MANIFEST.p6 },
      { name: 'Teamet', role: 'Vardagens hantverk', img: SALON_IMAGE_MANIFEST.p4 },
      { name: 'Teamet', role: 'Detaljspecialist', img: SALON_IMAGE_MANIFEST.p2 },
    ],
    stats: [
      ['Drop-in', 'varje dag'],
      ['Vasst', 'hantverk'],
      ['Prisvärt', 'alltid'],
    ],
  },
  linnea: {
    heroEyebrow: '— Naturligt & nära',
    heroTitle: 'Naturligt vacker,\nhelt enkelt.',
    heroLede:
      'En varm plats med fokus på det naturliga och genuina. Välkommen in för en stund av omtanke.',
    tagline: 'Naturlig omsorg',
    utility: 'Boka online dygnet runt · Välkommen in',
    italic: 'Det vackraste är det som sköts med omsorg.',
    aboutCopy:
      'Platsen för dig som vill göra det på riktigt. Vi arbetar med skonsamma produkter och naturliga material — och tar oss alltid tid.',
    servicesEyebrow: '— Utbud & priser',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Naturlig omsorg med omtanke',
    teamEyebrow: '— Vårt team',
    teamTitle: 'Människorna bakom omsorgen',
    heroImages: [LINNEA_IMG.hero1, LINNEA_IMG.hero2, LINNEA_IMG.hero3],
    galleryImages: [
      LINNEA_IMG.g1,
      LINNEA_IMG.g2,
      LINNEA_IMG.g3,
      LINNEA_IMG.g4,
      LINNEA_IMG.g5,
      LINNEA_IMG.g6,
    ],
    aboutImage: LINNEA_IMG.about,
    closingImage: LINNEA_IMG.closing,
    team: [
      { name: 'Naturligt', role: 'Skonsamma val', img: SALON_IMAGE_MANIFEST.p5 },
      { name: 'Vårt team', role: 'Omsorg & vård', img: SALON_IMAGE_MANIFEST.p1 },
      { name: 'Omtanke', role: 'Personlig service', img: SALON_IMAGE_MANIFEST.p3 },
    ],
    stats: [
      ['Eko', 'produkter'],
      ['Naturliga', 'material'],
      ['Skonsamt', 'hantverk'],
    ],
  },
  edit: {
    heroEyebrow: '— Studio',
    heroTitle: 'Form, färg\noch finess.',
    heroLede:
      'En redaktionell studio för precist hantverk och raffinerad form. Boka en tid i lugn och ro.',
    tagline: 'Form & färg, redaktionellt',
    utility: 'Boka online dygnet runt · Välkommen in',
    italic: 'Form är arkitektur i det lilla.',
    aboutCopy:
      'Studion för dig som vill ha något genomtänkt. Vi ser på hantverk som form — rent, modernt och personligt, varje gång.',
    servicesEyebrow: '— Utbud & priser',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Form, färg och finess',
    teamEyebrow: '— Studion',
    teamTitle: 'Människorna bakom formen',
    heroImages: [EDIT_IMG.hero1, EDIT_IMG.hero2, EDIT_IMG.hero3],
    galleryImages: [EDIT_IMG.g1, EDIT_IMG.g2, EDIT_IMG.g3, EDIT_IMG.g4, EDIT_IMG.g5, EDIT_IMG.g6],
    aboutImage: EDIT_IMG.about,
    closingImage: EDIT_IMG.closing,
    team: [
      { name: 'Studion', role: 'Precision & detalj', img: SALON_IMAGE_MANIFEST.p2 },
      { name: 'Erfarenhet', role: 'Form & finish', img: SALON_IMAGE_MANIFEST.p1 },
      { name: 'Studion', role: 'Färg & ton', img: SALON_IMAGE_MANIFEST.p3 },
    ],
    stats: [
      ['Precision', 'i varje detalj'],
      ['Modernt', 'hantverk'],
      ['Genomtänkt', 'form'],
    ],
  },
  // Flora — bohemisk blomsterbutik (florist-branschens tema). GENERIC evergreen-
  // copy som funkar för vilken florist som helst; Hantverksfloristernas egna texter
  // och foton bor i DERAS tenant (settings.copy + branding), inte här.
  flora: {
    heroEyebrow: '— Blomsterbutik',
    heroTitle: 'Blommor,\nbundna för hand.',
    heroLede:
      'En blomsterbutik med hantverket i centrum. Buketter i säsong, binderier och kurser — bundna med omsorg.',
    tagline: 'Blomsterhantverk i säsong',
    utility: 'Beställ online eller kom förbi · Välkommen in',
    italic: 'Var blomma har sin tid.',
    aboutCopy:
      'Vi brinner för blomsterhantverket — buketter bundna för hand, blommor i säsong och så närodlat som möjligt. Kvalitet och hållbarhet går hand i hand hos oss.',
    servicesEyebrow: '— Buketter & binderier',
    servicesTitle: 'Beställ hos oss',
    aboutTitle: 'Hantverk, säsong och omsorg',
    teamEyebrow: '— Vi i butiken',
    teamTitle: 'Floristerna bakom disken',
    heroImages: [
      FLORA_IMAGE_MANIFEST.shop,
      FLORA_IMAGE_MANIFEST.bouquet,
      FLORA_IMAGE_MANIFEST.peonies,
    ],
    galleryImages: [
      FLORA_IMAGE_MANIFEST.bouquet2,
      FLORA_IMAGE_MANIFEST.ranunculus,
      FLORA_IMAGE_MANIFEST.vase,
      FLORA_IMAGE_MANIFEST.wildflowers,
      FLORA_IMAGE_MANIFEST.rose,
      FLORA_IMAGE_MANIFEST.field,
    ],
    aboutImage: FLORA_IMAGE_MANIFEST.work,
    closingImage: FLORA_IMAGE_MANIFEST.greenhouse,
    team: [],
    stats: [
      ['Säsong', 'alltid'],
      ['Handbundet', 'hantverk'],
      ['Närodlat', 'när det går'],
    ],
  },
  // FreshCut — kundlåst kopia av den godkända 2026-sidan. Den finns kvar under sin
  // gamla nyckel men erbjuds aldrig andra tenants. Ägarens copy/media vinner fortfarande
  // fält för fält; dessa är bara FreshCuts lokala, återgivningsstabila defaults.
  freshcut: {
    heroEyebrow: 'Hår / Skägg / Finish',
    heroTitle: 'Klippt. Format. Klart.',
    heroLede:
      'En modern barbershop med respekt för hantverket. Vi gör jobbet ordentligt — du går härifrån skarpare.',
    tagline: 'Barbershop · Linköping City',
    utility: 'Barbershop · Linköping City',
    italic: 'Nästa lediga tid är bara några klick bort.',
    aboutCopy:
      'FreshCut är en etablerad barbershop mitt i Linköping. Här får du erfarenhet, ett lugnt bemötande och fullt fokus på att resultatet ska kännas rätt för dig.',
    servicesEyebrow: '— Behandlingar & priser',
    servicesTitle: 'Välj ditt upplägg.',
    aboutTitle: 'Din lokala barberare. Utan onödigt snack.',
    teamEyebrow: '— Våra barberare',
    teamTitle: 'Vi ses i stolen.',
    heroImages: ['/images/freshcut/freshcut-hero.webp'],
    galleryImages: [
      '/images/freshcut/freshcut-2.webp',
      '/images/freshcut/freshcut-3.webp',
      '/images/freshcut/freshcut-4.webp',
    ],
    aboutImage: '/images/freshcut/freshcut-barber.webp',
    closingImage: '/images/freshcut/freshcut-hero.webp',
    team: [],
    stats: [],
    homeSecondTitle: 'Detaljerna gör skillnaden.',
    whyTitle: 'Redo för en skarpare look?',
    whySub: 'Nästa lediga tid är bara några klick bort.',
    servicesIntro: 'Rätt behandling och rätt tid. Aktuella priser visas i bokningen.',
    resultsEyebrow: 'Resultatet',
    resultsLede: 'Fade, sax eller skarpa skägglinjer. Uttrycket varierar, nivån ska vara densamma.',
    resultImage1Caption: '01 / Fade',
    resultImage2Caption: '02 / Sax',
    resultImage3Caption: '03 / Skägg',
    studioImageCaption: 'Hantverk / Precision / Personligt',
    studioEyebrow: 'FreshCut Linköping',
    studioPoint1: 'Erfarenhet av herrhår, fade och skägg.',
    studioPoint2: 'Vi lyssnar först och klipper sedan.',
    studioPoint3: 'Mitt i city',
    contactEyebrow: 'Kontakt',
    contactTitle: 'Vi ses i stolen.',
    contactLede: 'Aktuella öppettider och alla lediga tider ser du alltid i bokningen.',
  },
} satisfies Partial<Record<StorefrontTheme, ThemeContentDefaults>>

export const THEME_CONTENT = Object.freeze({
  ...STATIC_THEME_CONTENT,
  ...Object.fromEntries(THEME_DEFINITIONS.map((theme) => [theme.key, theme.content])),
}) as unknown as Readonly<Record<StorefrontTheme, ThemeContent>>

/** Theme-content fields resolved directly against the owner's `settings.copy`. */
const COPY_FIELDS = [
  'heroEyebrow',
  'heroTitle',
  'heroLede',
  'aboutCopy',
  'tagline',
  'utility',
  'italic',
  'aboutTitle',
  'servicesEyebrow',
  'servicesTitle',
  'teamEyebrow',
  'teamTitle',
] as const

/**
 * Resolve the six editorial copy fields: owner override wins per field, otherwise
 * the per-theme default. DEFENSIVE — `copy` is persisted as JSON and is treated as
 * effectively `unknown`: only a
 * non-empty (post-trim) STRING is accepted; null/undefined/number/empty all fall
 * back to the theme default. The accepted string is used verbatim (inner `\n`
 * preserved); we only inspect the trimmed form to decide "set vs. unset".
 */
export function resolveTenantCopy(
  theme: StorefrontTheme,
  copy: CopyOverride | null | undefined,
): Pick<ThemeContent, (typeof COPY_FIELDS)[number]> {
  const base = THEME_CONTENT[theme]
  const c = (copy ?? {}) as Record<string, unknown>
  const pick = (key: (typeof COPY_FIELDS)[number]): string => {
    const v = c[key]
    return typeof v === 'string' && v.trim().length > 0 ? v : base[key]
  }
  return {
    heroEyebrow: pick('heroEyebrow'),
    heroTitle: pick('heroTitle'),
    heroLede: pick('heroLede'),
    aboutCopy: pick('aboutCopy'),
    tagline: pick('tagline'),
    utility: pick('utility'),
    italic: pick('italic'),
    aboutTitle: pick('aboutTitle'),
    servicesEyebrow: pick('servicesEyebrow'),
    servicesTitle: pick('servicesTitle'),
    teamEyebrow: pick('teamEyebrow'),
    teamTitle: pick('teamTitle'),
  }
}

/**
 * Resolve the per-theme content + owner overrides into a single object the layouts
 * consume. Owner-uploaded media in `settings.branding.*` wins; otherwise the strong
 * per-theme default fills in, so an un-uploaded salon still looks complete.
 *
 * `copy` (optional) is the owner's `settings.copy` override. When omitted the
 * editorial fields keep their theme defaults. The persisted copy contract and
 * merge rules live in `lib/storefront/theme-copy.ts`.
 */
export function resolveThemeContent(
  theme: StorefrontTheme,
  branding: TenantBranding | null | undefined,
  copy?: CopyOverride | null,
): ResolvedThemeContent {
  const base = THEME_CONTENT[theme]
  const b = withoutLegacySnittStats(theme, branding ?? {})
  const heroImages =
    Array.isArray(b.hero_images) && b.hero_images.length ? b.hero_images : base.heroImages
  const galleryImages =
    Array.isArray(b.gallery_images) && b.gallery_images.length
      ? b.gallery_images
      : base.galleryImages
  // Team is OWNER-ONLY: the storefront shows the salon's own uploaded team, never
  // theme stock faces presented as their staff. Empty → the layout hides the team
  // section entirely (until the owner uploads real members). Blank-name entries drop.
  const team = (Array.isArray(b.team) ? b.team : []).filter(
    (m) => m && typeof m.name === 'string' && m.name.trim().length > 0,
  )
  const stats = Array.isArray(b.stats) && b.stats.length ? b.stats : base.stats
  // Startsidans om-sektion: egen hem-text vinner, annars samma som Om oss-sidan.
  const cRaw = (copy ?? {}) as Record<string, unknown>
  const homeAboutOverride =
    typeof cRaw.aboutCopyHome === 'string' && cRaw.aboutCopyHome.trim().length > 0
      ? cRaw.aboutCopyHome
      : null
  const resolvedCopy = resolveTenantCopy(theme, copy)
  // Mall-egna extrafält: ägaren vinner, annars följer temats exakta default med.
  // Flera nya teman deklarerar dessa i sin .theme.ts; att skriva `undefined` här
  // efter `...base` tappade tidigare t.ex. Kallas contactTitle och Snitts ingress.
  const baseFields = base as ThemeContentDefaults & Record<string, unknown>
  const extra = (key: string): string | undefined => {
    const v = cRaw[key]
    if (typeof v === 'string' && v.trim().length > 0) return v
    const fallback = baseFields[key]
    return typeof fallback === 'string' ? fallback : undefined
  }
  return {
    ...base,
    // Owner copy overrides (per-field; empty/missing → theme default).
    ...resolvedCopy,
    aboutCopyHome: homeAboutOverride ?? resolvedCopy.aboutCopy,
    homeSecondTitle: extra('homeSecondTitle'),
    whyTitle: extra('whyTitle'),
    whySub: extra('whySub'),
    whyBody: extra('whyBody'),
    servicesIntro: extra('servicesIntro'),
    teamLead: extra('teamLead'),
    closingEyebrow: extra('closingEyebrow'),
    closingTitle: extra('closingTitle'),
    closingLede: extra('closingLede'),
    contactEyebrow: extra('contactEyebrow'),
    contactTitle: extra('contactTitle'),
    pillar1Title: extra('pillar1Title'),
    pillar1Body: extra('pillar1Body'),
    pillar1Link: extra('pillar1Link'),
    pillar2Title: extra('pillar2Title'),
    pillar2Body: extra('pillar2Body'),
    pillar2Link: extra('pillar2Link'),
    pillar3Title: extra('pillar3Title'),
    pillar3Body: extra('pillar3Body'),
    pillar3Link: extra('pillar3Link'),
    shopEyebrow: extra('shopEyebrow'),
    shopTitle: extra('shopTitle'),
    shopCta: extra('shopCta'),
    blogEyebrow: extra('blogEyebrow'),
    blogTitle: extra('blogTitle'),
    blogCta: extra('blogCta'),
    giftEyebrow: extra('giftEyebrow'),
    giftLede: extra('giftLede'),
    giftCta: extra('giftCta'),
    // Bakåtkompatibelt: en gammal galleryEyebrow-override fortsätter styra hemmet
    // tills ägaren sparar den nya, separata startsidesnyckeln.
    homeGalleryEyebrow: extra('homeGalleryEyebrow') ?? extra('galleryEyebrow'),
    galleryEyebrow: extra('galleryEyebrow'),
    findEyebrow: extra('findEyebrow'),
    clubEyebrow: extra('clubEyebrow'),
    clubTitle: extra('clubTitle'),
    clubLede: extra('clubLede'),
    clubCta: extra('clubCta'),
    clubNote: extra('clubNote'),
    galleryTitle: extra('galleryTitle'),
    galleryLede: extra('galleryLede'),
    resultsEyebrow: extra('resultsEyebrow'),
    resultsLede: extra('resultsLede'),
    resultImage1Caption: extra('resultImage1Caption'),
    resultImage2Caption: extra('resultImage2Caption'),
    resultImage3Caption: extra('resultImage3Caption'),
    studioImageCaption: extra('studioImageCaption'),
    studioEyebrow: extra('studioEyebrow'),
    studioPoint1: extra('studioPoint1'),
    studioPoint2: extra('studioPoint2'),
    studioPoint3: extra('studioPoint3'),
    contactLede: extra('contactLede'),
    heroImages,
    galleryImages,
    aboutImage:
      typeof b.about_image === 'string' && b.about_image ? b.about_image : base.aboutImage,
    closingImage:
      typeof b.closing_image === 'string' && b.closing_image ? b.closing_image : base.closingImage,
    team,
    stats,
  }
}

/** Freeze the copy a tenant sees now so a new layout cannot replace it with its defaults. */
export function materializeThemeCopy(
  theme: StorefrontTheme,
  effectiveCopy: CopyOverride | null | undefined,
): CopyOverride {
  const explicit = cleanCopyOverride(effectiveCopy)
  const materialized = cleanCopyOverride(resolveThemeContent(theme, null, effectiveCopy))

  // Dessa två är härledda fallbacks. Frys dem bara när kunden uttryckligen har
  // gjort dem fristående; annars ska framtida ändringar fortsätta följa källfältet.
  if (
    explicit.aboutCopyHome === undefined &&
    materialized.aboutCopyHome === materialized.aboutCopy
  ) {
    delete materialized.aboutCopyHome
  }
  if (
    explicit.homeGalleryEyebrow === undefined &&
    materialized.homeGalleryEyebrow === materialized.galleryEyebrow
  ) {
    delete materialized.homeGalleryEyebrow
  }
  return materialized
}
