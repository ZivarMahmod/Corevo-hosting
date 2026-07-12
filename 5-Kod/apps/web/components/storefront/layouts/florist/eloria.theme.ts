import type { FloristTheme } from './types'
import { EloriaNav, EloriaFooter } from './eloria.chrome'
import { EloriaOm, EloriaTjanster, EloriaKontakt } from './eloria.pages'
import { EloriaShop, EloriaBlogg } from './eloria.modules'

/** Unsplash photo manifest — every id below verified `curl -sI` → 200 (2026-07-11). */
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  heroL: u('1582794543139-8ac9cb0f7b11'),
  heroR: u('1589458456444-f7158a7e8a4f'),
  heroSpare: u('1593069369643-a6d42e2e3cb4'),
  g1: u('1524835391568-32c8f7016d73', 900),
  g2: u('1508610048659-a06b669e3321', 900),
  g3: u('1582874576091-26fa231ce87c', 900),
  g4: u('1598453055371-0f5e37113bea', 900),
  g5: u('1596309322315-da9e713cbb22', 900),
  g6: u('1716982360804-b0bfdb28103e', 900),
  about: u('1727520327526-4b435667860a'),
  closing: u('1782038522623-f2d1b419d5f9'),
  p1: u('1782038522334-94a51783e4a1', 700),
  p2: u('1707089174472-3fe57719f46b', 700),
  p3: u('1552268889-4ddad0d04c0a', 700),
} as const

/**
 * ELORIA — blush, mörkgrön och guld i klassisk premium-stil (florist-sviten,
 * goal-58). Motsatsen till Mina: en mörkgrön guldramad "platta" mitt i heron,
 * tunna guld-löftesikoner, eleganta höga shop/blogg-kort (4:5), en klassisk
 * prislista med guld-dotterade linjer och en mörkgrön scrim-closing som ekar
 * heron. Se EloriaLayout.tsx för den fullständiga sektionssignaturen.
 *
 * SKÄRPE-PASS (design-skarpa-zentum.md) — färgfamiljen är ORÖRD (samma blush,
 * samma mörkgröna, samma guld-kulör ~41°); bara LJUSHETEN i guldet är justerad.
 *
 * RADIE — binär. `radius: '0px'` (var '3px') driver --sf-radius, alltså ALL
 * struktur: heroplattan, butikskort, bloggkort, galleribrickor, om-fotot, kartan.
 * Knappen är enda undantaget och är en FULL pill (--radius-pill). 0 eller pill,
 * inget däremellan — 3px var varken en kant att linjera mot eller en medveten
 * kapsel, alltså precis den mjuka moroten.
 *
 * FÄRG — 8 hex: EXAKT de 8 tokens nedan, noll dekorfärger utöver dem. Mallens
 * mörkgröna (#182A20) ÄR temats bläck: `fg` bär den, och eloria.module.css läser
 * den som `--eloria-green: var(--color-fg)`. Samma grepp som zentum, där #111926
 * är BÅDE textfärg och mörk yta — den mörka färgen gör dubbel tjänst i stället för
 * att kosta en nionde hex. (Bläcket var #241B15, en varm nästan-svart; plattan och
 * scrimmen har oförändrad kulör.) Guldet är den enda accenten och sitter bara på
 * småytor. Kontrasten är RÄKNAD (WCAG), inte gissad:
 *
 *   fg #182A20 på bg #FBF3EE (rubrik) ................ 13.77:1  (krav ≥7, mål 11)
 *   fg #182A20 på surface #FFFFFF .................... 15.10:1
 *   fg #182A20 på accentSoft #F5E4DC ................. 12.23:1
 *   fg2 #6B5548 på bg (brödtext) ...................... 6.35:1  (krav ≥4.5)
 *   fg2 #6B5548 på surface ............................ 6.96:1
 *   #FFFFFF på primary #7A5D1E (knapptext) ............ 6.15:1  (krav ≥4.5; var 4.98)
 *   #FFFFFF på primaryD (knapp-hover) ................. 8.79:1
 *   primary på bg (eyebrow/pris/linjer) ............... 5.61:1  (var 4.55)
 *   primary på accentSoft (presentkortsraden) ......... 4.99:1  (VAR 4.04 = FAIL)
 *   bg på --eloria-green (heroplattans rubrik) ....... 13.77:1
 *   bg @82% på --eloria-green (lede/brödtext) ......... 9.71:1
 *   guld-ljus på --eloria-green (eyebrow + guldram) ... 5.99:1  (VAR 3.03 = FAIL)
 *
 * Guldet mörkades ett steg (#8A6B27 → #7A5D1E) för att lyfta knapptexten och
 * presentkortsradens eyebrow över 4.5:1. På de mörkgröna ytorna gick det åt andra
 * hållet: temats guld läser bara 3.03:1 mot grönt, så där används ett LJUSARE guld
 * (--eloria-gold) som är en color-mix av två BEFINTLIGA tokens — noll nya hex.
 */
export const eloria: FloristTheme = {
  key: 'eloria',
  name: 'Eloria',
  desc: 'Blush · mörkgrön · guld — klassisk premium',
  palette: {
    primary: '#7A5D1E',
    primaryD: '#5E4715',
    bg: '#FBF3EE',
    surface: '#FFFFFF',
    // Bläcket ÄR mallens mörkgröna (heroplattan, offertbannern, closing-scrimmen
    // läser den som --eloria-green). Dubbel tjänst = 8 hex i stället för 9.
    fg: '#182A20',
    fg2: '#6B5548',
    line: '#E8D9C9',
    accentSoft: '#F5E4DC',
  },
  fonts: {
    display: 'var(--font-playfair), Georgia, serif',
    body: 'var(--font-source-sans), system-ui, sans-serif',
  },
  radius: '0px',
  content: {
    heroEyebrow: '— Klassisk blomsterhandel',
    heroTitle: 'Blommor för\nlivets stora stunder.',
    heroLede:
      'Handbundna buketter i tidlös stil — snittade i säsong, komponerade med omsorg och levererade med värdighet.',
    tagline: 'Blomsterhandel i klassisk stil',
    utility: 'Leverans samma dag vid beställning innan kl 14 · Handbundet i butik',
    italic: 'Det bästa av säsongen, komponerat med omsorg.',
    aboutCopy:
      'Vi är en blomsterhandel som tror på det tidlösa — klassiska snitt, ärligt hantverk och buketter som håller vad de lovar. Varje beställning binds för hand av någon som kan sitt hantverk.',
    servicesEyebrow: '— Våra tjänster',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Om oss',
    teamEyebrow: '— Teamet',
    teamTitle: 'Händerna bakom varje bukett',
    heroImages: [IMG.heroL, IMG.heroR, IMG.heroSpare],
    galleryImages: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6],
    aboutImage: IMG.about,
    closingImage: IMG.closing,
    team: [
      { name: 'Vårt team', role: 'Florister', img: IMG.p1 },
      { name: 'Beställning & bud', role: 'Butik & leverans', img: IMG.p2 },
      { name: 'Bindning', role: 'Buketter & binderi', img: IMG.p3 },
    ],
    stats: [
      ['100%', 'handbundet'],
      ['Samma dag', 'leverans'],
      ['Klassisk', 'stil'],
    ],
  },
  caps: {
    heroEyebrow: true,
    homeStats: true,
    homeGallery: true,
    homeAbout: true,
  },
  // goal-61 editor-paritet: mallens EGNA redigerbara element (Sida-editorn). Defaults =
  // layoutens inbyggda fallback-strängar VERBATIM (EloriaLayout.tsx = hemmets band).
  // OBS: eloria.modules.tsx har EGNA fallbacks på modulsidorna för shopEyebrow
  // (dynamisk fulfilment-etikett), shopTitle ('Ur butiken') och blogTitle
  // ('Ord om blommor') — ett sparat värde styr BÅDA ytorna, tomt fält låter varje
  // yta behålla sin egen inbyggda text. hero/about/services/closing/contact-nycklarna
  // har redan egna redigeringskort och deklareras inte här.
  extraHome: [
    { name: 'shopEyebrow', label: 'Butiks-bandet: eyebrow', default: '— Ur butiken' },
    { name: 'shopTitle', label: 'Butiks-bandet: rubrik', default: 'Beställ något klassiskt' },
    { name: 'shopCta', label: 'Butiks-bandet: knapptext', default: 'Visa hela butiken' },
    { name: 'blogEyebrow', label: 'Blogg-bandet: eyebrow', default: '— Från bloggen' },
    { name: 'blogTitle', label: 'Blogg-bandet: rubrik', default: 'Säsong, tips & inspiration' },
    { name: 'blogCta', label: 'Blogg-bandet: knapptext', default: 'Läs hela bloggen' },
    { name: 'galleryEyebrow', label: 'Galleri: eyebrow', default: '— Galleri' },
    { name: 'giftEyebrow', label: 'Presentkort-raden: eyebrow', default: '— Presentkort' },
    { name: 'giftLede', label: 'Presentkort-raden: text', default: 'Ge bort något tidlöst.' },
    { name: 'giftCta', label: 'Presentkort-raden: länktext', default: 'Till presentkorten' },
    { name: 'findEyebrow', label: 'Plats-sektionen: eyebrow', default: '— Hitta till butiken' },
  ],
  /* TEMA-PAKET (goal-59): Eloria äger sitt SIDHUVUD, sin SIDFOT och sina UNDERSIDOR.
     Nav = mörkgrön platta med guldramat, centrerat wordmark och menyn i två grupper;
     footer = samma platta i tre guldlinjerade kolumner; /om = guldramat uppslag,
     /tjanster = prislista med guld-ledare, /kontakt = ett guldramat kort. */
  // ownsUtility: EloriaNav ritar sin egen guldremsa ur utilityText (se ThemeChrome).
  chrome: { Nav: EloriaNav, Footer: EloriaFooter, ownsUtility: true },
  pages: { om: EloriaOm, tjanster: EloriaTjanster, kontakt: EloriaKontakt },
  /* MODUL-VYER (goal-59, vektor-regeln): butiken och bloggen renderas i Elorias form —
     höga 4:5-kort med guldlinjen under namnet, bloggen som guldramat uppslag. Modulen
     äger fortfarande funktionen (AddToCart, priser, livscykel, korg). */
  moduleViews: { shop: EloriaShop, blogg: EloriaBlogg },
}
