import type { FloristTheme } from './types'
import { CalytrixNav, CalytrixFooter } from './calytrix.chrome'
import { CalytrixOm, CalytrixTjanster, CalytrixKontakt } from './calytrix.pages'
import { CalytrixShop, CalytrixBlogg } from './calytrix.modules'

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
  //   2. `line` och `accentSoft` slogs ihop till EN rosa ton (#e8d9de) för att spara
  //      en hex. goal-60 skilde dem åt igen — hopslagningen var fel:
  //      #e8d9de mot bg = 1.27:1 och mot surface = 1.36:1. Kortets kant är kortets
  //      ENDA avgränsning (surface #fff mot bg #fbf6f4 är 1.06:1 — samma färg för
  //      ögat), så kanten är en UI-gräns och lyder WCAG 1.4.11 (≥ 3:1). Den syntes
  //      inte → produktkorten flöt ihop med sidan och butiken såg ut som "bara bilder".
  //      `line` är nu #a98d97 (3.02:1 mot surface, 2.82:1 mot bg), samma plommon-rosa
  //      hue-familj — bara mättad och mörknad. `accentSoft` behåller #e8d9de: den
  //      mjuka YTAN ska vara mjuk, den bär ingen gräns.
  // Summa: 8 hex här + guldet = 9, en över taket. Det är medvetet: taket finns för
  // att hålla mallen skarp, och en osynlig kant är motsatsen till skarp. En regel som
  // tvingar fram en osynlig UI-gräns tjänar inte sitt syfte.
  palette: {
    primary: '#7d1f46',
    primaryD: '#4a0e2e',
    bg: '#fbf6f4',
    surface: '#ffffff',
    fg: '#241019',
    fg2: '#6e4f5c',
    line: '#a98d97',
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
  // goal-60: navets höjd är TEMADATA, inte layout-CSS (samma lärdom som onyx i v1.9.1
  // — en `:global()`-regel utan lokal klass går inte att bygga). NavShell är fixed;
  // utan detta reserverar main plattformens default 116px medan Calytrix kluster
  // (annonsrad ~37px + navrad ~68px) är högre → navet la sig över innehållet.
  navHeight: { desktop: '108px', mobile: '96px' },
  // COPY-RÖST (goal-60): Calytrix är E-HANDELSMALLEN — butiken är hjälten. Rösten är
  // säljande, konkret och snabb: pris, sortiment, leverans. Den poetiska ateljé-tonen
  // ("blommor säger det orden inte hinner") hör hemma i Lunaria/Seraphina, inte här.
  // Evergreen: ingen adress, inget årtal, inga betyg — mallen används av MÅNGA kunder.
  content: {
    heroEyebrow: '— Blomsterbutik online',
    heroTitle: 'Beställ blommor\nidag',
    heroLede:
      'Hela sortimentet finns online. Välj bukett, betala på ett par klick — hämta i butiken eller få det hemlevererat.',
    tagline: 'Färska blommor, snabbt levererade.',
    utility: 'Beställ före kl 14 — levereras samma dag →',
    italic: 'Färska blommor, redo att skickas.',
    aboutCopy:
      'Vi driver en blomsterbutik med hela sortimentet online. Du ser priset direkt, väljer i lugn och ro och betalar på ett par klick — sedan står buketten redo för hämtning eller går ut med bud. Enkelt att beställa, snabbt att få.',
    servicesEyebrow: '— Priser & beställning',
    servicesTitle: 'Beställ direkt',
    aboutTitle: 'Butiken, alltid öppen',
    teamEyebrow: '— Butiken',
    teamTitle: 'De som packar din beställning',
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
  // ownsUtility: CalytrixNav ritar sin egen plommonfärgade annonsrad ur utilityText.
  // Utan flaggan renderar NavShell OCKSÅ plattformens mörka remsa → två staplade rader.
  chrome: { Nav: CalytrixNav, Footer: CalytrixFooter, ownsUtility: true },
  pages: { om: CalytrixOm, tjanster: CalytrixTjanster, kontakt: CalytrixKontakt },
  // goal-59 MODUL-VYER: butiken/bloggen renderas i mallens form (modulen äger
  // funktionen: data, köp-räls, livscykel — den ändras aldrig av en mall).
  moduleViews: { shop: CalytrixShop, blogg: CalytrixBlogg },
  // goal-61 editor-paritet: mallens redigerbara element utöver de generella korten.
  // default = layoutens inbyggda fallback-sträng VERBATIM (CalytrixLayout.tsx).
  // OBS: shopEyebrow/shopTitle/blogTitle läses även av modul-vyerna med dynamiska
  // tenant-fallbacks (calytrix.modules.tsx) — defaulten här är HEM-bandens statiska.
  extraHome: [
    { name: 'shopEyebrow', label: 'Butiks-bandet: eyebrow', default: '— Mest sålda' },
    { name: 'shopTitle', label: 'Butiks-bandet: rubrik', default: 'Beställ det alla vill ha' },
    { name: 'shopCta', label: 'Butiks-bandet: knapptext', default: 'Visa hela butiken' },
    { name: 'blogEyebrow', label: 'Blogg-bandet: eyebrow', default: '— Från bloggen' },
    { name: 'blogTitle', label: 'Blogg-bandet: rubrik', default: 'Nytt från floristen' },
    { name: 'blogCta', label: 'Blogg-bandet: knapptext', default: 'Läs hela bloggen' },
    { name: 'giftEyebrow', label: 'Presentkort-raden: eyebrow', default: '— Presentkort' },
    { name: 'giftLede', label: 'Presentkort-raden: text', default: 'Ge bort något som blommar.' },
    { name: 'giftCta', label: 'Presentkort-raden: länktext', default: 'Till presentkorten' },
    { name: 'galleryEyebrow', label: 'Galleri: eyebrow', default: '— Galleri' },
    { name: 'findEyebrow', label: 'Plats-raden: eyebrow', default: '— Hitta hit' },
  ],
}
