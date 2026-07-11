import type { FloristTheme } from './types'

/** Unsplash photo manifest — every id below verified `curl -sI` → 200 (2026-07-11). */
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  heroL: u('1490750967868-88aa4486c946'),
  heroR: u('1462275646964-a0e3386b89fa'),
  heroSpare: u('1518895949257-7621c3c786d7'),
  g1: u('1502977249166-824b3a8a4d6d', 900),
  g2: u('1508610048659-a06b669e3321', 900),
  g3: u('1500382017468-9049fed747ef', 900),
  g4: u('1494972308805-463bc619d34e', 900),
  g5: u('1470509037663-253afd7f0f51', 900),
  g6: u('1466692476868-aef1dfb1e735', 900),
  about: u('1526047932273-341f2a7631f9'),
  closing: u('1487530811176-3780de880c2d'),
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1500648767791-00dcc994a43e', 700),
  p3: u('1438761681033-6461ffad8d80', 700),
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
 * FÄRG — 9 hex: de 8 tokens nedan + mallens ENDA dekorfärg (--eloria-green
 * #182a20, deklarerad i eloria.module.css rot-klassen). Guldet är den enda
 * accenten och sitter bara på småytor. Kontrasten är RÄKNAD (WCAG), inte gissad:
 *
 *   fg #241B15 på bg #FBF3EE (rubrik) ................ 15.42:1  (krav ≥7, mål 11)
 *   fg #241B15 på surface #FFFFFF .................... 16.90:1
 *   fg #241B15 på accentSoft #F5E4DC ................. 13.69:1
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
    fg: '#241B15',
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
}
