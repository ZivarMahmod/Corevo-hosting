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
import { FLORIST_CONTENT } from './layouts/florist/registry'
import { EKONOMI_CONTENT } from './layouts/ekonomi/registry'
import { SALONG_CONTENT } from './layouts/salong/registry'

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
  /** Per-theme SECTION HEADERS (theme-default, not owner-editable). These vary the
   *  editorial voice per theme and replace the previously hardcoded strings in
   *  sections.tsx / tjanster page. They flow to consumers via `...base` in
   *  resolveThemeContent; they are NOT part of the owner CopyOverride set. */
  servicesEyebrow: string
  servicesTitle: string
  aboutTitle: string
  teamEyebrow: string
  teamTitle: string
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
  g5: u('1559599101-f09722fb4948', 900),
  g6: u('1457972729786-0411a3b2b626', 900),
} as const

// goal-62 D2 — EGNA FOTON PER MALL. De fem äldre mallarna delade ETT bildmanifest
// (IMG ovan): salvia, leander, linnea och edit ledde med samma salongsinteriör i olika
// färg. En egen mall är en egen typ av branding — då kan den inte ha grannens bilder.
// Foto-id:n är hämtade och HEAD-verifierade av scripts/foton-per-mall.mjs (kör
// `node scripts/foton-per-mall.mjs --verify` för att kolla att de fortfarande lever).
const SALVIA_IMG = {
  hero1: u('1695527081728-e3a42f0ce261'),
  hero2: u('1695527081793-91a2d4b5b103'),
  hero3: u('1781450090585-1a511b7066d9'),
  about: u('1695527081874-b674c46f40fb'),
  closing: u('1626383137804-ff908d2753a2'),
  g1: u('1626379501846-0df4067b8bb9', 900),
  g2: u('1600948836101-f9ffda59d250', 900),
  g3: u('1695527081848-1e46c06e6458', 900),
  g4: u('1746723378067-83a345ff3160', 900),
  g5: u('1695527081827-fdbc4e77be9b', 900),
  g6: u('1746723391801-1a24f7a57730', 900),
} as const
const LEANDER_IMG = {
  hero1: u('1712178435871-48d630f15969'),
  hero2: u('1716203499461-5a1edb4b5e06'),
  hero3: u('1711349172547-3246a21a4c0d'),
  about: u('1725021119504-2cb1e9e4c082'),
  closing: u('1597010107510-5f74525a5297'),
  g1: u('1627716762987-d22098e86b3f', 900),
  g2: u('1642775589620-ca13d73e00a6', 900),
  g3: u('1694208115105-fec57298ea42', 900),
  g4: u('1656231586368-3b6dc842a876', 900),
  g5: u('1528756514091-dee5ecaa3278', 900),
  g6: u('1640905423713-e8acfb33724e', 900),
} as const
const ZIGGE_IMG = {
  hero1: u('1779524477261-12141ccbd8d9'),
  hero2: u('1778409762668-cf893875d611'),
  hero3: u('1708166210391-6822d91d2895'),
  about: u('1781931298124-88833761114f'),
  closing: u('1695632918735-c78986bf3b39'),
  g1: u('1781226968695-9ce2d4c0271b', 900),
  g2: u('1769734416095-30fbc03e7bb7', 900),
  g3: u('1778784544843-712029254a98', 900),
  g4: u('1775126454577-4846f3e55cc5', 900),
  g5: u('1779556507342-7951f64a3b86', 900),
  g6: u('1763081756934-ea920762e6ad', 900),
} as const
const LINNEA_IMG = {
  hero1: u('1505576391880-b3f9d713dc4f'),
  hero2: u('1646054346214-2c20bc25b86f'),
  hero3: u('1762755647813-017e128a4ba0'),
  about: u('1776211961209-468d71038aa1'),
  closing: u('1776211961018-f15d43aefe9e'),
  g1: u('1775769383410-06e6823e3afb', 900),
  g2: u('1776211961042-500a2459caa0', 900),
  g3: u('1733896781401-9518c71f7c72', 900),
  g4: u('1748351970583-327f50884b5d', 900),
  g5: u('1690397814893-b4c29217eb5b', 900),
  g6: u('1768152859365-337f962fe1e3', 900),
} as const
const EDIT_IMG = {
  hero1: u('1599332069800-fcf11ed035ff'),
  hero2: u('1644978448908-fc907d2495b2'),
  hero3: u('1662039352486-aeca40b40c39'),
  about: u('1781925856343-c97d0d44f94c'),
  closing: u('1596232168371-e4d32dd0aee3'),
  g1: u('1616105996583-f9e3c00bb31f', 900),
  g2: u('1510032518699-36e55fe15658', 900),
  g3: u('1781455589910-d5bd2132d3dc', 900),
  g4: u('1715407754988-4d617cdf0a4e', 900),
  g5: u('1540163558217-3aa12d20edf6', 900),
  g6: u('1700868329999-056910348977', 900),
} as const

// Flora-temats generiska blomster-foton (Unsplash, verifierade 200 OK 2026-07-11).
const FLORA_IMG = {
  shop: u('1487530811176-3780de880c2d'),
  bouquet: u('1490750967868-88aa4486c946'),
  peonies: u('1462275646964-a0e3386b89fa'),
  work: u('1526047932273-341f2a7631f9'),
  wildflowers: u('1470509037663-253afd7f0f51'),
  ranunculus: u('1494972308805-463bc619d34e'),
  vase: u('1502977249166-824b3a8a4d6d'),
  greenhouse: u('1466692476868-aef1dfb1e735'),
  bouquet2: u('1508610048659-a06b669e3321', 900),
  rose: u('1518895949257-7621c3c786d7', 900),
  field: u('1500382017468-9049fed747ef', 900),
} as const

export const THEME_CONTENT: Record<StorefrontTheme, ThemeContent> = {
  // FLORIST-SVITEN (goal-58): copy + fotostandard för de 13 mallarna bor i deras
  // egna <key>.theme.ts (florist/registry.ts). Spridda först — nycklarna nedan är
  // disjunkta, så ordningen skuggar ingenting.
  ...(FLORIST_CONTENT as Record<StorefrontTheme, ThemeContent>),
  ...(EKONOMI_CONTENT as Record<StorefrontTheme, ThemeContent>),
  ...(SALONG_CONTENT as Record<StorefrontTheme, ThemeContent>),
  salvia: {
    heroEyebrow: '— Välkommen in',
    heroTitle: 'Varsamt utfört.\nSkönt mottagen.',
    heroLede:
      'En stilla plats där varje besök får ta sin tid. Boka en stund som är helt din.',
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
    galleryImages: [SALVIA_IMG.g1, SALVIA_IMG.g2, SALVIA_IMG.g3, SALVIA_IMG.g4, SALVIA_IMG.g5, SALVIA_IMG.g6],
    aboutImage: SALVIA_IMG.about,
    closingImage: SALVIA_IMG.closing,
    team: [
      { name: 'Vårt team', role: 'Hantverk & omsorg', img: IMG.p1 },
      { name: 'Erfarenhet', role: 'Specialister', img: IMG.p3 },
      { name: 'Omtanke', role: 'Personlig service', img: IMG.p5 },
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
    galleryImages: [LEANDER_IMG.g1, LEANDER_IMG.g2, LEANDER_IMG.g3, LEANDER_IMG.g4, LEANDER_IMG.g5, LEANDER_IMG.g6],
    aboutImage: LEANDER_IMG.about,
    closingImage: LEANDER_IMG.closing,
    team: [
      { name: 'Ateljén', role: 'Hantverk & detaljer', img: IMG.p2 },
      { name: 'Erfarenhet', role: 'Form & finish', img: IMG.p4 },
      { name: 'Omsorg', role: 'Personlig ton', img: IMG.p1 },
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
    galleryImages: [ZIGGE_IMG.g1, ZIGGE_IMG.g2, ZIGGE_IMG.g3, ZIGGE_IMG.g4, ZIGGE_IMG.g5, ZIGGE_IMG.g6],
    aboutImage: ZIGGE_IMG.about,
    closingImage: ZIGGE_IMG.closing,
    team: [
      { name: 'Teamet', role: 'Snabbt & vasst', img: IMG.p6 },
      { name: 'Teamet', role: 'Vardagens hantverk', img: IMG.p4 },
      { name: 'Teamet', role: 'Detaljspecialist', img: IMG.p2 },
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
    galleryImages: [LINNEA_IMG.g1, LINNEA_IMG.g2, LINNEA_IMG.g3, LINNEA_IMG.g4, LINNEA_IMG.g5, LINNEA_IMG.g6],
    aboutImage: LINNEA_IMG.about,
    closingImage: LINNEA_IMG.closing,
    team: [
      { name: 'Naturligt', role: 'Skonsamma val', img: IMG.p5 },
      { name: 'Vårt team', role: 'Omsorg & vård', img: IMG.p1 },
      { name: 'Omtanke', role: 'Personlig service', img: IMG.p3 },
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
      { name: 'Studion', role: 'Precision & detalj', img: IMG.p2 },
      { name: 'Erfarenhet', role: 'Form & finish', img: IMG.p1 },
      { name: 'Studion', role: 'Färg & ton', img: IMG.p3 },
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
    heroImages: [FLORA_IMG.shop, FLORA_IMG.bouquet, FLORA_IMG.peonies],
    galleryImages: [FLORA_IMG.bouquet2, FLORA_IMG.ranunculus, FLORA_IMG.vase, FLORA_IMG.wildflowers, FLORA_IMG.rose, FLORA_IMG.field],
    aboutImage: FLORA_IMG.work,
    closingImage: FLORA_IMG.greenhouse,
    team: [],
    stats: [
      ['Säsong', 'alltid'],
      ['Handbundet', 'hantverk'],
      ['Närodlat', 'när det går'],
    ],
  },
  // FreshCut — exakt kopia av freshcut.se (barbershop, Linköping). Copy defaults are
  // this salon's own strings (its own named theme; the platform is going on ice with
  // FreshCut as the one live tenant). SWAPPABLE things — hero/gallery photos, logo,
  // colours, phone/address — stay in tenant_settings (seeded at provisioning, edited in
  // /admin/varumarke); the image defaults below are generic barber stock for the un-
  // seeded state. Section titles that don't fit the 6-field copy contract live as
  // constants in FreshCutLayout.
  freshcut: {
    heroEyebrow: '— Barbershop',
    heroTitle: 'FreshCut',
    heroLede: 'Barbershop i centrala Linköping',
    tagline: 'Barbershop i centrala Linköping',
    utility: 'Boka tid online · Välkommen in',
    italic: 'Mer än bara en frisörsalong.',
    aboutCopy:
      'I våra fräscha lokaler mitt i Linköping City känner du dig väl omhändertagen av våra barberare, som har mångårig erfarenhet inom herrklippningar. Oavsett om du vill snygga till ditt skägg, ögonbryn eller håret hjälper vi alltid till att göra dig helt nöjd med din klippning.',
    servicesEyebrow: '— Prislista',
    servicesTitle: 'Priser. Som tål att jämföras.',
    aboutTitle: 'FreshCut gör dig nöjd.',
    teamEyebrow: '— Våra barberare',
    teamTitle: 'Våra barberare.',
    heroImages: [IMG.barberCut, IMG.barberShop, IMG.barberTools],
    galleryImages: [IMG.barberCut, IMG.beard, IMG.barberShop, IMG.barberTools],
    aboutImage: IMG.barberTools,
    closingImage: IMG.barberShop,
    team: [],
    stats: [],
  },
}

/**
 * Owner-editable storefront COPY (the shared M2↔M6 copy-content contract).
 *
 * Where it lives: `tenant_settings.settings` JSON under the top-level key `copy`
 * (NOT in `branding` jsonb — that column is co-owned by M7 and gets rewritten on
 * platform branding saves; `settings` is merged `...prev` by M6's saveSettings, so
 * `copy` survives partial updates). NO schema change — the schema is frozen.
 *
 * Every field is OPTIONAL. A missing field — and, deliberately, an EMPTY or
 * whitespace-only string — falls back to the per-theme default in THEME_CONTENT,
 * so clearing a field reverts to the evergreen theme copy rather than rendering a
 * blank hero. `heroTitle` may contain a `\n` for a two-line display break (the
 * default does); only the outer whitespace is trimmed for the "is it set?" test.
 *
 * NOTE: `utility` (the thin top utility-strip micro-copy) is intentionally NOT in
 * this set — it stays theme-default always. Only the six editorial fields below
 * are owner-editable. Media/team/stats keep their existing `branding.*` merge.
 *
 * M6 WRITER CONTRACT: M6 persists owner edits via its existing saveSettings
 * `...prev` merge as `settings.copy = { heroEyebrow, heroTitle, heroLede,
 * aboutCopy, tagline, italic }` (any subset; omit/blank a field to fall back).
 * M6 does NOT call into this module — it only writes the `settings.copy` shape.
 */
export type CopyOverride = {
  heroEyebrow?: string
  heroTitle?: string
  heroLede?: string
  aboutCopy?: string
  /** Egen om-text för STARTSIDANS om-sektion (Zivar: hem och Om oss ska kunna säga
   *  olika saker). Fallback-kedja: aboutCopyHome → aboutCopy → temats default. */
  aboutCopyHome?: string
  tagline?: string
  italic?: string
  /** Liten rubrik/eyebrow vid om-sektionen (AboutSplit + FreshCut-hemmet). */
  aboutTitle?: string
  /** Mall-egna hem-sektioner (t.ex. FreshCut): rubrik för andra sektionen. */
  homeSecondTitle?: string
  /** Mall-egna "Varför oss"-sektionen (FreshCut): rubrik, underrad, brödtext. */
  whyTitle?: string
  whySub?: string
  whyBody?: string
  /** Tjänster-sidan: eyebrow + rubrik (temadefault finns) + intro-rad (sid-default). */
  servicesEyebrow?: string
  servicesTitle?: string
  servicesIntro?: string
  /** Team-sektionen på Om oss: eyebrow + rubrik (temadefault) + lead-rad (sid-default). */
  teamEyebrow?: string
  teamTitle?: string
  teamLead?: string
  /** Avslutningssektionen (stora bilden längst ner på Om/Kontakt). */
  closingEyebrow?: string
  closingTitle?: string
  closingLede?: string
  /** Kontakt-sidan: eyebrow + rubrik för "Plats & öppettider". */
  contactEyebrow?: string
  contactTitle?: string
  /** goal-57 körning 13: floras verksamhets-pelare + invävda modul-band — varje
   *  synligt element redigerbart. Tomt = layoutens inbyggda text. */
  pillar1Title?: string
  pillar1Body?: string
  pillar1Link?: string
  pillar2Title?: string
  pillar2Body?: string
  pillar2Link?: string
  pillar3Title?: string
  pillar3Body?: string
  pillar3Link?: string
  shopEyebrow?: string
  shopTitle?: string
  shopCta?: string
  blogEyebrow?: string
  blogTitle?: string
  blogCta?: string
  giftEyebrow?: string
  giftLede?: string
  giftCta?: string
  /** Startsidespecifik bild-/galleri-caption. Separat från gallerisidans eyebrow. */
  homeGalleryEyebrow?: string
  galleryEyebrow?: string
  findEyebrow?: string
  /**
   * goal-64: KLUBBENS + GALLERIETS rubriker (de tre nya sidorna).
   *
   * Varje mall döper sin klubb själv — "Vänkretsen", "Kretsen", "Söndagsklubben",
   * "Första raden", "Insidan" — och den texten ÄR mallen. Fälten finns här så ägaren
   * kan skriva om dem utan att röra koden; mall-vyn bär designens sträng verbatim som
   * inbyggd fallback (samma mönster som shopTitle/blogTitle, K13).
   *
   * clubNote = den lilla raden UNDER klubbens kort/formulär (Ateljé Vinters
   * "184 medlemmar · nästa visning 3 augusti", Elorias andra brevstycke).
   */
  clubEyebrow?: string
  clubTitle?: string
  clubLede?: string
  clubCta?: string
  clubNote?: string
  galleryTitle?: string
  galleryLede?: string
}

/** The six theme-content fields the owner may override via `settings.copy`. */
const COPY_FIELDS = ['heroEyebrow', 'heroTitle', 'heroLede', 'aboutCopy', 'tagline', 'italic', 'aboutTitle', 'servicesEyebrow', 'servicesTitle', 'teamEyebrow', 'teamTitle'] as const

/** ALLA nycklar i CopyOverride — whitelisten för bransch-mall-texten (goal-57
 *  körning 12: verticals.default_copy bär samma fältkontrakt som settings.copy). */
export const COPY_OVERRIDE_KEYS = [
  'heroEyebrow', 'heroTitle', 'heroLede', 'aboutCopy', 'aboutCopyHome', 'tagline',
  'italic', 'aboutTitle', 'homeSecondTitle', 'whyTitle', 'whySub', 'whyBody',
  'servicesEyebrow', 'servicesTitle', 'servicesIntro', 'teamEyebrow', 'teamTitle',
  'teamLead', 'closingEyebrow', 'closingTitle', 'closingLede', 'contactEyebrow',
  'contactTitle',
  // goal-57 körning 13: floras pelare + modul-band
  'pillar1Title', 'pillar1Body', 'pillar1Link',
  'pillar2Title', 'pillar2Body', 'pillar2Link',
  'pillar3Title', 'pillar3Body', 'pillar3Link',
  'shopEyebrow', 'shopTitle', 'shopCta',
  'blogEyebrow', 'blogTitle', 'blogCta',
  'giftEyebrow', 'giftLede', 'giftCta',
  'homeGalleryEyebrow', 'galleryEyebrow', 'findEyebrow',
  // goal-64: klubben + galleriet (de tre nya sidorna)
  'clubEyebrow', 'clubTitle', 'clubLede', 'clubCta', 'clubNote',
  'galleryTitle', 'galleryLede',
] as const

/** Sanera en rå jsonb till en ren CopyOverride: bara kända nycklar, bara icke-tomma
 *  strängar (trimmade för "satt?"-testet, värdet behålls verbatim), tak 4000 tecken.
 *  Delas av bransch-mall-läsaren (vertical-copy.ts) och spar-actionen. PURE. */
export function cleanCopyOverride(raw: unknown): CopyOverride {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  const r = raw as Record<string, unknown>
  for (const k of COPY_OVERRIDE_KEYS) {
    const v = r[k]
    if (typeof v === 'string' && v.trim().length > 0 && v.length <= 4000) out[k] = v
  }
  return out as CopyOverride
}

/** Lager-merge (goal-57 körning 12): branschens mall-text i botten, kundens egna
 *  ICKE-TOMMA fält ovanpå. Resultatet matas in som `copy` i resolve-funktionerna,
 *  så kedjan blir kund → bransch → tema utan att resolverna ändras. PURE. */
export function layerCopy(
  verticalCopy: CopyOverride,
  tenantCopy: CopyOverride | null | undefined,
): CopyOverride | null {
  const t = (tenantCopy ?? {}) as Record<string, unknown>
  const merged: Record<string, string> = { ...(verticalCopy as Record<string, string>) }
  for (const k of COPY_OVERRIDE_KEYS) {
    const v = t[k]
    if (typeof v === 'string' && v.trim().length > 0) merged[k] = v
  }
  return Object.keys(merged).length > 0 ? (merged as CopyOverride) : null
}

/**
 * Resolve the six editorial copy fields: owner override wins per field, otherwise
 * the per-theme default. DEFENSIVE — `copy` arrives from frozen `parseSettings`
 * which does NOT validate it, so it is treated as effectively `unknown`: only a
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
 * `copy` (optional) is the owner's `settings.copy` override. When omitted the six
 * editorial fields keep their theme defaults — so the three current two-arg callers
 * compile and behave exactly as before. M2 threads `settings.copy` through as the
 * third arg to surface owner-edited copy (see CopyOverride above).
 */
export type ResolvedThemeContent = ThemeContent & {
  /** Startsidans om-sektion: aboutCopyHome-override → aboutCopy → temats default. */
  aboutCopyHome: string
  /** Mall-egna sektioner (bara satta när ägaren skrivit egna — layouten faller
   *  annars tillbaka på sina inbyggda texter, t.ex. FreshCuts "Varför Oss?"). */
  homeSecondTitle?: string
  whyTitle?: string
  whySub?: string
  whyBody?: string
  /** Sid-texter utan temadefault: satta bara när ägaren skrivit egna — render-
   *  stället faller annars tillbaka på sin inbyggda text. */
  servicesIntro?: string
  teamLead?: string
  closingEyebrow?: string
  closingTitle?: string
  closingLede?: string
  contactEyebrow?: string
  contactTitle?: string
  /** goal-57 körning 13: floras pelare + modul-band (satta bara vid egen text —
   *  layouten faller annars tillbaka på sina inbyggda strängar). */
  pillar1Title?: string
  pillar1Body?: string
  pillar1Link?: string
  pillar2Title?: string
  pillar2Body?: string
  pillar2Link?: string
  pillar3Title?: string
  pillar3Body?: string
  pillar3Link?: string
  shopEyebrow?: string
  shopTitle?: string
  shopCta?: string
  blogEyebrow?: string
  blogTitle?: string
  blogCta?: string
  giftEyebrow?: string
  giftLede?: string
  giftCta?: string
  homeGalleryEyebrow?: string
  galleryEyebrow?: string
  findEyebrow?: string
  /** goal-64: klubbens + galleriets rubriker (satta bara vid egen text — mall-vyn
   *  faller annars tillbaka på designens sträng verbatim). */
  clubEyebrow?: string
  clubTitle?: string
  clubLede?: string
  clubCta?: string
  clubNote?: string
  galleryTitle?: string
  galleryLede?: string
}

/**
 * Vad en MALL får leverera som sina standardtexter: bas-kontraktet (ThemeContent)
 * plus de sektions-texter som annars bara kan komma från ägaren (shopEyebrow,
 * blogTitle, giftLede, closingTitle …, goal-57 K13). resolveThemeContent sprider
 * `...base` → sätter mallen dem följer de med hela vägen till layouten, och ägarens
 * settings.copy skriver fortfarande över dem per fält. Utan den här typen tvingas en
 * mall till `as ThemeContent` (excess-property-check), vilket TYST döljer stavfel.
 */
export type ThemeContentDefaults = ThemeContent &
  Partial<Omit<ResolvedThemeContent, keyof ThemeContent>>

export function resolveThemeContent(
  theme: StorefrontTheme,
  branding: TenantBranding | null | undefined,
  copy?: CopyOverride | null,
): ResolvedThemeContent {
  const base = THEME_CONTENT[theme]
  const b = branding ?? {}
  const heroImages = Array.isArray(b.hero_images) && b.hero_images.length ? b.hero_images : base.heroImages
  const galleryImages =
    Array.isArray(b.gallery_images) && b.gallery_images.length ? b.gallery_images : base.galleryImages
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
  // Mall-egna extrafält: bara med när ägaren skrivit något (layouten har egna defaults).
  const extra = (key: string): string | undefined => {
    const v = cRaw[key]
    return typeof v === 'string' && v.trim().length > 0 ? v : undefined
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
    heroImages,
    galleryImages,
    aboutImage: typeof b.about_image === 'string' && b.about_image ? b.about_image : base.aboutImage,
    closingImage:
      typeof b.closing_image === 'string' && b.closing_image ? b.closing_image : base.closingImage,
    team,
    stats,
  }
}
