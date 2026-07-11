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
    servicesEyebrow: '— Behandlingar & priser',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Hantverk, kvalitet och personlig service',
    teamEyebrow: '— Våra frisörer',
    teamTitle: 'Människorna bakom stolen',
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
    servicesEyebrow: '— Färg, klipp & behandlingar',
    servicesTitle: 'Tjänster & priser',
    aboutTitle: 'Hantverk och värme i varje besök',
    teamEyebrow: '— Vårt team',
    teamTitle: 'Människorna i ateljén',
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
    servicesEyebrow: '— Klipp, skägg & priser',
    servicesTitle: 'TJÄNSTER',
    aboutTitle: 'RENT HANTVERK, INGEN KRÅNGEL',
    teamEyebrow: '— Teamet',
    teamTitle: 'KILLARNA & TJEJERNA BAKOM STOLEN',
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
    servicesEyebrow: '— Behandlingar & priser',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Naturlig hårvård med omtanke',
    teamEyebrow: '— Våra frisörer',
    teamTitle: 'Människorna bakom stolen',
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
    servicesEyebrow: '— Behandlingar & priser',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Form, färg och finess',
    teamEyebrow: '— Studion',
    teamTitle: 'Människorna bakom formen',
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
}

/** The six theme-content fields the owner may override via `settings.copy`. */
const COPY_FIELDS = ['heroEyebrow', 'heroTitle', 'heroLede', 'aboutCopy', 'tagline', 'italic', 'aboutTitle', 'servicesEyebrow', 'servicesTitle', 'teamEyebrow', 'teamTitle'] as const

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
}

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
    heroImages,
    galleryImages,
    aboutImage: typeof b.about_image === 'string' && b.about_image ? b.about_image : base.aboutImage,
    closingImage:
      typeof b.closing_image === 'string' && b.closing_image ? b.closing_image : base.closingImage,
    team,
    stats,
  }
}
