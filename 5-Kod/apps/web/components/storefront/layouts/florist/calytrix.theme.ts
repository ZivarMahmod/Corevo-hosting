import type { FloristTheme } from './types'
import { CalytrixNav, CalytrixFooter } from './calytrix.chrome'
import { CalytrixOm, CalytrixTjanster, CalytrixKontakt } from './calytrix.pages'

// Calytrix-temats egen fotomanifest (Unsplash, verifierade 200 OK 2026-07-11).
// Lokal u() — INGEN värde-import från theme-content.ts (bara `import type` tillåts
// från delade moduler; en värde-import hit skulle skapa en cirkulär import eftersom
// theme-content.ts importerar FLORIST_CONTENT från registry.ts som importerar denna fil).
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  heroMain: u('1583160247711-2191776b4b91'),
  heroAlt1: u('1602934585418-f588bea4215c'),
  heroAlt2: u('1584589167171-541ce45f1eea'),
  about: u('1519378058457-4c29a0a2efac'),
  closing: u('1533616688419-b7a585564566'),
  g1: u('1518895949257-7621c3c786d7', 900),
  g2: u('1509721434272-b79147e0e708', 900),
  g3: u('1465146344425-f00d5f5c8f07', 900),
  g4: u('1487070183336-b863922373d4', 900),
  g5: u('1560717845-968823efbee1', 900),
  g6: u('1520763185298-1b434c919102', 900),
  p1: u('1518895949257-7621c3c786d7', 700),
  p2: u('1465146344425-f00d5f5c8f07', 700),
  p3: u('1487070183336-b863922373d4', 700),
} as const

/**
 * CALYTRIX — plommon/vinröd e-handelsflorist (florist-sviten, goal-58). Butiken är
 * hjälten: smal annonsrad → fullbredds foto-hero med jättestor serif-rubrik och
 * guldknapp → mörkt marknadsförings-band → horisontell "Mest sålda"-rad med
 * flytande pill-badge → tjänster → om → blogg → galleri → plats → closing. Se
 * CalytrixLayout.tsx för sektionsordningen i sin helhet.
 */
export const calytrix: FloristTheme = {
  key: 'calytrix',
  name: 'Calytrix',
  desc: 'Plommon & vinrött · butiken som hjälte',
  // Paletten är MÄTT, inte gissad (WCAG 2.x relativ luminans):
  //   fg      #241019 på bg  16.84:1 · på surface 18.05:1   (krav ≥ 7:1)
  //   fg2     #6e4f5c på bg   6.67:1 · på surface  7.15:1 · på tonen 5.25:1  (≥ 4.5:1)
  //   primary #7d1f46 → #fff på knapp 9.74:1 · som länk på bg 9.08:1 · på tonen 7.15:1
  //   #fff på primaryD (annonsrad + band) 15.07:1
  //
  // HEX-BUDGET (≤8, dekor inräknad). Paletten är sidans HELA färgbudget minus
  // mallens ena accent (antikguldet i calytrix.module.css) — 8 palett + guld +
  // egen guld-ink = 10, två över taket. Två återbruk, noll nya kulörer:
  //   1. guld-inken → --color-fg (7.35:1 på guld, bättre än den egna #2b1608:s 7.00).
  //   2. `line` och `accentSoft` var två toner av SAMMA rosa (#e8d9de / #f4e6ea) i
  //      olika roller. En ton räcker: #e8d9de bär både hårlinjen och den mjuka ytan.
  //      Den ljusare togs bort, inte den mörkare — en hårlinje i #f4e6ea på vitt
  //      ligger på 1.05:1 och försvinner, och en linje som inte syns är ingen linje.
  // Summa: 7 hex här + guldet = 8. Varje ny hex måste betala för sig med en gammal.
  palette: {
    primary: '#7d1f46',
    primaryD: '#4a0e2e',
    bg: '#fbf6f4',
    surface: '#ffffff',
    fg: '#241019',
    fg2: '#6e4f5c',
    line: '#e8d9de',
    accentSoft: '#e8d9de',
  },
  fonts: {
    // DM Serif Display levereras BARA i vikt 400 (app/layout.tsx). Mallen sätter
    // därför display-vikt 400 rakt igenom — 500/600/700 hade gett syntetisk fetstil.
    display: 'var(--font-dmserif), Georgia, serif',
    body: 'var(--font-inter), system-ui, sans-serif',
  },
  // BINÄR radie: 0 på all struktur (kort, bilder, karta, om-foto) — knapparna är
  // full pill via den globala .btn-accent (--radius-pill), badgen är pill (999px).
  // Inget däremellan. 14px på allt var precis den "mjuka moroten" passet tog bort.
  radius: '0px',
  content: {
    heroEyebrow: '— Blomsterbutik',
    heroTitle: 'Blommor alla\nfaller för',
    heroLede:
      'Säsongens finaste snitt, bundna för hand. Beställ online, hämta i butik eller få det levererat till dörren.',
    tagline:
      'Vi finns här för alla dina blommiga behov — varje beställning packas med omsorg.',
    utility: 'Missa inte säsongens blommor →',
    italic: 'Blommor säger det orden inte hinner.',
    aboutCopy:
      'Vi är en blomsterbutik där varje bukett binds för hand med säsongens bästa snitt. Oavsett om du handlar i butiken eller beställer hem till dörren möter du samma omsorg i varje detalj.',
    servicesEyebrow: '— Beställ & boka',
    servicesTitle: 'Tjänster & priser',
    aboutTitle: 'Blommor med omsorg, från butik till dörr',
    teamEyebrow: '— Floristerna',
    teamTitle: 'Människorna bakom varje bukett',
    heroImages: [IMG.heroMain, IMG.heroAlt1, IMG.heroAlt2],
    galleryImages: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6],
    aboutImage: IMG.about,
    closingImage: IMG.closing,
    team: [
      { name: 'Vårt team', role: 'Floristerna i butiken', img: IMG.p1 },
      { name: 'Beställningar', role: 'Bukett & binderi', img: IMG.p2 },
      { name: 'Leverans', role: 'Bud & hämtning', img: IMG.p3 },
    ],
    stats: [
      ['Färskt', 'varje leverans'],
      ['Handbundet', 'av floristen'],
      ['Enkelt', 'att beställa'],
    ],
  },
  caps: { heroEyebrow: false, homeStats: true, homeGallery: true, homeAbout: true },
  // goal-59 TEMA-PAKET: mallen äger sitt sidhuvud (annonsrad + split-nav), sin mörka
  // sidfot och alla tre undersidorna — inte bara hemmets hero.
  chrome: { Nav: CalytrixNav, Footer: CalytrixFooter },
  pages: { om: CalytrixOm, tjanster: CalytrixTjanster, kontakt: CalytrixKontakt },
}
