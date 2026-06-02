// Per-theme editorial COPY + MEDIA defaults for the five storefront layouts.
//
// The real tenant bundle (lib/tenant-data) carries only name, services, location
// and owner-uploaded media (settings.branding.{hero_images,gallery_images,
// about_image,closing_image,team,stats}). It has NO hero/about/italic copy in the
// data model. The five handoff layouts, however, lead with that copy. So this
// module supplies a per-theme set of evergreen, GENERIC copy (tone modelled on the
// handoff data.js) plus strong per-theme photography fallbacks — used whenever the
// owner has not uploaded their own. Nothing here is bound to a specific real salon
// (no fake addresses/years/ratings tied to a name): the strings are honest,
// brand-neutral and safe for any tenant on the chosen theme.
//
// Plain <img> srcs only (the remote-image config is frozen → never next/image).

import type { TenantBranding } from '@corevo/ui'
import type { StorefrontTheme } from '@/lib/tenant-data'

export type ThemeTeamMember = { name: string; role: string; img: string }
export type ThemeStat = [value: string, label: string]

export type ThemeContent = {
  /** Small uppercase label above the hero headline (the salon "kind"). */
  heroEyebrow: string
  /** Hero headline — may contain a \n for a two-line display break. */
  heroTitle: string
  /** Hero supporting paragraph. */
  heroLede: string
  /** One-line tagline used in the footer / utility copy. */
  tagline: string
  /** Thin top utility-strip micro-copy. */
  utility: string
  /** Italic warmth phrase used in About / quote bands. */
  italic: string
  /** "Om salongen" body copy. */
  aboutCopy: string
  /** Strong per-theme defaults (used only when the owner hasn't uploaded). */
  heroImages: string[]
  galleryImages: string[]
  aboutImage: string
  closingImage: string
  team: ThemeTeamMember[]
  stats: ThemeStat[]
}

// Shared Unsplash photography manifest (salon / hair / barber), mirroring the
// handoff's IMG set so every theme can lead with a fitting photo before upload.
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  salonInterior: u('1521590832167-7bcbfaa6381f'),
  salonChairs: u('1560066984-138dadb4c035'),
  styling: u('1633681926035-ec1ac984418a'),
  cutting: u('1599351431202-1e0f0137899a'),
  washing: u('1595476108010-b4d1f102b1b1'),
  color: u('1522336572468-97b06e8ef143'),
  barberShop: u('1585747860715-2ba37e788b70'),
  barberCut: u('1503951914875-452162b0f3f1'),
  barberTools: u('1622286342621-4bd786c2447c'),
  beard: u('1621605815971-fbc98d665033'),
  // portraits
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1500648767791-00dcc994a43e', 700),
  p3: u('1438761681033-6461ffad8d80', 700),
  p4: u('1507003211169-0a1dd7228f2d', 700),
  p5: u('1573497019940-1c28c88b4f3e', 700),
  p6: u('1544005313-94ddf0286df2', 700),
  // gallery / inspiration
  g1: u('1605497788044-5a32c7078486', 900),
  g2: u('1492106087820-71f1a00d2b11', 900),
  g3: u('1487412947147-5cebf100ffc2', 900),
  g4: u('1519699047748-de8e457a634e', 900),
  g5: u('1562004760-acb5df9d8d2a', 900),
  g6: u('1457972729786-0411a3b2b626', 900),
} as const

export const THEME_CONTENT: Record<StorefrontTheme, ThemeContent> = {
  salvia: {
    heroEyebrow: '— Frisörsalong',
    heroTitle: 'Skarpt klippt.\nSkönt mottagen.',
    heroLede:
      'En stilla salong där varje klippning får ta sin tid. Boka en stund som är helt din.',
    tagline: 'Hårvård med lugn hand',
    utility: 'Boka online dygnet runt · Välkommen in',
    italic: 'Varje stol är en stund för sig själv.',
    aboutCopy:
      'Hos oss ska ett frisörbesök kännas som en paus, inte ett ärende. Vi är ett litet team som bryr oss om hantverket och om dig som sitter i stolen.',
    heroImages: [IMG.salonInterior, IMG.styling, IMG.salonChairs],
    galleryImages: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6],
    aboutImage: IMG.washing,
    closingImage: IMG.salonChairs,
    team: [
      { name: 'Vårt team', role: 'Frisörer & stylister', img: IMG.p1 },
      { name: 'Färg & slingor', role: 'Färgspecialister', img: IMG.p3 },
      { name: 'Klippning', role: 'Klipp & form', img: IMG.p5 },
    ],
    stats: [
      ['100%', 'hantverk'],
      ['Lugn', 'takt'],
      ['Personlig', 'service'],
    ],
  },
  leander: {
    heroEyebrow: '— Salong & färgateljé',
    heroTitle: 'Din frisör\ni lugn och ro',
    heroLede:
      'En varm ateljé för färg, klipp och omsorg. Vi tar emot dig som en gäst, inte ett bokningsnummer.',
    tagline: 'Färg, klipp och omsorg',
    utility: 'Fri konsultation inför färg · Välkommen in',
    italic: 'Vacker hårfärg börjar med ett samtal.',
    aboutCopy:
      'Hos oss möts hantverk och värme. Vi arbetar med skandinaviska färgtekniker och en lugn, personlig ton — för att du ska gå härifrån som mest lik dig själv.',
    heroImages: [IMG.styling, IMG.color, IMG.salonInterior],
    galleryImages: [IMG.g4, IMG.g5, IMG.g2, IMG.g6, IMG.g1, IMG.g3],
    aboutImage: IMG.color,
    closingImage: IMG.styling,
    team: [
      { name: 'Coloriste', role: 'Färg & balayage', img: IMG.p2 },
      { name: 'Senior frisör', role: 'Klipp & form', img: IMG.p4 },
      { name: 'Frisör', role: 'Färg & slingor', img: IMG.p1 },
    ],
    stats: [
      ['Färg', 'specialister'],
      ['Lugn', 'ateljé'],
      ['Personlig', 'omsorg'],
    ],
  },
  zigge: {
    heroEyebrow: '— Frisör & barberare',
    heroTitle: 'RENT SNITT.\nINGEN KRÅNGEL.',
    heroLede:
      'Klippning och skäggvård för alla. Drop in eller boka online — du sitter i stolen samma dag.',
    tagline: 'Frisör & barberare',
    utility: 'Drop in eller boka online · Öppet alla dagar',
    italic: 'Av frisörer, för alla.',
    aboutCopy:
      'Hörnsalongen där frisör möter barberare. Vi håller det enkelt, vasst och prisvärt — och vi minns hur du gillar din fade.',
    heroImages: [IMG.barberShop, IMG.barberCut, IMG.barberTools],
    galleryImages: [IMG.barberCut, IMG.beard, IMG.barberShop, IMG.barberTools, IMG.g6, IMG.cutting],
    aboutImage: IMG.barberTools,
    closingImage: IMG.barberShop,
    team: [
      { name: 'Barberare', role: 'Skägg & fade', img: IMG.p6 },
      { name: 'Barberare', role: 'Klipp & trim', img: IMG.p4 },
      { name: 'Frisör', role: 'Fade-specialist', img: IMG.p2 },
    ],
    stats: [
      ['Drop-in', 'varje dag'],
      ['Vasst', 'hantverk'],
      ['Prisvärt', 'alltid'],
    ],
  },
  linnea: {
    heroEyebrow: '— Frisör & färgsalong',
    heroTitle: 'Naturligt vacker,\nhelt enkelt.',
    heroLede:
      'En varm salong med fokus på friskt hår och naturliga toner. Välkommen in för en stund av omtanke.',
    tagline: 'Naturlig hårvård',
    utility: 'Boka online dygnet runt · Välkommen in',
    italic: 'Det vackraste håret är friskt hår.',
    aboutCopy:
      'Salongen för dig som vill vårda ditt hår på riktigt. Vi arbetar med skonsamma produkter och naturliga färger — och tar oss alltid tid.',
    heroImages: [IMG.washing, IMG.salonInterior, IMG.styling],
    galleryImages: [IMG.g3, IMG.g1, IMG.g5, IMG.g2, IMG.g4, IMG.g6],
    aboutImage: IMG.washing,
    closingImage: IMG.salonInterior,
    team: [
      { name: 'Färg', role: 'Naturliga toner', img: IMG.p5 },
      { name: 'Frisör', role: 'Klipp & vård', img: IMG.p1 },
      { name: 'Frisör', role: 'Hårvård', img: IMG.p3 },
    ],
    stats: [
      ['Eko', 'produkter'],
      ['Friskt', 'hår'],
      ['Skonsamt', 'hantverk'],
    ],
  },
  edit: {
    heroEyebrow: '— Hårstudio',
    heroTitle: 'Form, färg\noch finess.',
    heroLede:
      'En redaktionell hårstudio för precisa klipp och raffinerad färg. Boka en tid i lugn och ro.',
    tagline: 'Klipp & färg, redaktionellt',
    utility: 'Boka online dygnet runt · Välkommen in',
    italic: 'Ett klipp är arkitektur för håret.',
    aboutCopy:
      'Studion för dig som vill ha ett genomtänkt klipp. Vi ser på hår som form — rent, modernt och personligt, varje gång.',
    heroImages: [IMG.cutting, IMG.color, IMG.salonChairs],
    galleryImages: [IMG.g2, IMG.g4, IMG.g1, IMG.g3, IMG.g6, IMG.g5],
    aboutImage: IMG.cutting,
    closingImage: IMG.salonChairs,
    team: [
      { name: 'Stylist', role: 'Precisionsklipp', img: IMG.p2 },
      { name: 'Senior frisör', role: 'Klipp & form', img: IMG.p1 },
      { name: 'Coloriste', role: 'Färg & ton', img: IMG.p3 },
    ],
    stats: [
      ['Precision', 'i varje klipp'],
      ['Modernt', 'hantverk'],
      ['Genomtänkt', 'form'],
    ],
  },
}

/**
 * Resolve the per-theme content + owner overrides into a single object the layouts
 * consume. Owner-uploaded media in `settings.branding.*` wins; otherwise the strong
 * per-theme default fills in, so an un-uploaded salon still looks complete.
 */
export type ResolvedThemeContent = ThemeContent

export function resolveThemeContent(
  theme: StorefrontTheme,
  branding: TenantBranding | null | undefined,
): ResolvedThemeContent {
  const base = THEME_CONTENT[theme]
  const b = branding ?? {}
  const heroImages = Array.isArray(b.hero_images) && b.hero_images.length ? b.hero_images : base.heroImages
  const galleryImages =
    Array.isArray(b.gallery_images) && b.gallery_images.length ? b.gallery_images : base.galleryImages
  const team = Array.isArray(b.team) && b.team.length ? b.team : base.team
  const stats = Array.isArray(b.stats) && b.stats.length ? b.stats : base.stats
  return {
    ...base,
    heroImages,
    galleryImages,
    aboutImage: typeof b.about_image === 'string' && b.about_image ? b.about_image : base.aboutImage,
    closingImage:
      typeof b.closing_image === 'string' && b.closing_image ? b.closing_image : base.closingImage,
    team,
    stats,
  }
}
