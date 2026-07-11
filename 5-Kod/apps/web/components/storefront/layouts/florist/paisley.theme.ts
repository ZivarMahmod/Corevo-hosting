import type { FloristTheme } from './types'

// Paisleys egen fotomanifest (Unsplash, curl -sI 200 OK + visuellt granskade
// 2026-07-11 — flera slumpvis testade Unsplash-id:n visade sig vara arkitektur/
// hund/blåbär/skor trots giltig 200, så varje id nedan är öppnat och synat).
// Lokal u() — INGEN värde-import från theme-content.ts (bara `import type` är
// tillåtet från delade moduler; en värde-import hit skulle skapa en cirkulär
// import eftersom theme-content.ts importerar FLORIST_CONTENT från registry.ts
// som importerar denna fil).
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  hero: u('1494972308805-463bc619d34e'), // mörka rosor uppifrån, tidningsomslag
  celebrateMain: u('1560343090-f0409e92791a'), // aprikosfärgad pion-bukett, band
  celebrateInset: u('1518895949257-7621c3c786d7'), // ensam rosa ros i glasvas
  about: u('1533616688419-b7a585564566'), // levande orange bukett, ljus bakgrund
  closing: u('1465146344425-f00d5f5c8f07'), // rosa vallmo i vetefält
  g1: u('1563241527-3004b7be0ffd', 900), // rosa/creme/vinröda rosor i vas
  g2: u('1596438459194-f275f413d6ff', 900), // aprikosfärgad bukett, kraftpapper
  g3: u('1520763185298-1b434c919102', 900), // rosa tulpan, rosa bakgrund
  g4: u('1502977249166-824b3a8a4d6d', 900), // rosa lilja i glasflaska
  g5: u('1470509037663-253afd7f0f51', 900), // solrosfält
  g6: u('1490750967868-88aa4486c946', 900), // orange vallmofält
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1500648767791-00dcc994a43e', 700),
} as const

/**
 * PAISLEY — tegelröd/rost redaktionell florist (florist-sviten, goal-58). EGEN
 * sektionsordning (ingen annan mall i sviten har den): (1) topprad med
 * leveransområde + Kontakt/Om/Leveransorter, (2) tegelröd annonsrad, (3)
 * centrerat skript-wordmark med spärrade versal-nav-länkar under, (4) fullbredds
 * foto-hero med enorm versal-serif-rubrik i bilden + fyrkantig CTA, (5) mörkt
 * tegelband "beställ före 15:00" med statisk DEKOR-nedräkning (tre rutor, inga
 * riktiga sekunder), (6) "Fira med blommor" — brett två-kolumns text+bildkollage,
 * (7) shop-teasers, (8) tjänster (numrerade rader), (9) om, (10) blogg, (11)
 * plats, (12) closing i eget fullbredds-foto. Presentkort vävs in som en smal
 * rad mellan plats och closing. Se PaisleyLayout.tsx för sektionerna i sin
 * helhet. Känsla: skarp tidningslayout — versaler, rakt, bestämt.
 */
export const paisley: FloristTheme = {
  key: 'paisley',
  name: 'Paisley',
  desc: 'Tegelrött & benvitt · redaktionell tidningskänsla',
  // ÅTTA hexar, EN hue-familj (tegel/rost 10–30°) + de neutrala. EN accent:
  // `primary` — den sitter på små ytor (eyebrow, pris, knapp, annonsrad), aldrig
  // som stor bakgrundsyta. Hierarkin görs av SKALAN och KONTRASTEN, inte av kulör.
  //
  // WCAG-kontrast, räknad (oberoende ommätning 2026-07-11) — inga gissningar:
  //   fg      #231b15 på bg #f6f0e2 ....... 14.92:1  AAA (krav ≥7, mål 11)
  //   fg      #231b15 på surface #fffcf5 .. 16.54:1  AAA
  //   fg-2    #6c5d4e på bg ............... 5.58:1   AA  (krav ≥4.5 — backar medvetet)
  //   primary #a43f2a på bg ............... 5.56:1   AA  (eyebrow/pris, 11–12px)
  //   surface #fffcf5 på primary .......... 6.17:1   AA  (knapptext, krav ≥4.5)
  //   surface #fffcf5 på primary-d ........ 11.99:1  AAA (text + inverterad knapp
  //                                                  på det mörka tegelbandet)
  //   primary #a43f2a på accent-soft ...... 4.74:1   AA  (presentkortsraden)
  // Knapptexten är benvit (--pa-ink), INTE #ffffff: den globala .btn-accent tar
  // sin text ur --color-accent-fg = #ffffff, vilket vore en nionde färg utanför
  // paletten. paisley.module.css .paSquareCta sätter --pa-ink istället.
  // Antal färger i mallen = exakt 8 (dessa) — scrimsen är color-mix på
  // --color-fg / --color-primary-d, inte egna RGB-tripletter.
  palette: {
    primary: '#a43f2a',
    primaryD: '#5c2318',
    bg: '#f6f0e2',
    surface: '#fffcf5',
    fg: '#231b15',
    fg2: '#6c5d4e',
    line: '#ded0ba',
    accentSoft: '#f0dcc7',
  },
  fonts: {
    // DM Serif Display: tung didone-liknande tabloid-serif. VIKTIGT: next/font
    // laddar den med `weight: '400'` och ENBART style normal (app/layout.tsx) —
    // så varje font-weight 600/700 eller font-style: italic på display-text ger
    // SYNTETISK fetstil/kursiv (browsern smetar ut 400-konturerna). Tyngden ska
    // komma av storlek och versaler, aldrig av font-weight. Jost (variabel, äkta
    // 600) bär mikrotexten. Se paisley.module.css --pa-fw-display / --pa-fw-micro.
    display: 'var(--font-dmserif), Georgia, serif',
    body: 'var(--font-jost), system-ui, sans-serif',
  },
  // BINÄR radie: 0 på ALLT strukturellt (bilder, kort, knappar, karta). Var 2px —
  // en "nästan rak" kant är det värsta av två världar: den läser som slarv, inte
  // som ett val. Raka kanter linjerar mot varandra; det är själva skärpan.
  radius: '0px',
  content: {
    heroEyebrow: '— Handbundet varje dag',
    heroTitle: 'Blommor med\nkaraktär',
    heroLede:
      'Säsongens råvara, bunden med en fast hand. Beställ hem, hämta i butiken eller boka en stund hos oss.',
    tagline: 'Färska snitt, bundna för hand — varje dag på året.',
    utility: 'Handbundet i butiken · Beställ online',
    italic: 'En bukett säger det du inte hinner.',
    aboutCopy:
      'Vi är en redaktionellt sinnad blomsterhandel: vi väljer råvaran med samma noggrannhet som en tidning väljer sina ord. Varje bukett binds för hand, av samma händer som öppnar butiken varje morgon.',
    servicesEyebrow: '— Beställ & boka',
    servicesTitle: 'Tjänster & priser',
    aboutTitle: 'Hantverk, valt med skarp blick',
    teamEyebrow: '— Floristerna',
    teamTitle: 'Händerna bakom varje bukett',
    heroImages: [IMG.hero, IMG.celebrateMain, IMG.celebrateInset],
    galleryImages: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6],
    aboutImage: IMG.about,
    closingImage: IMG.closing,
    team: [
      { name: 'Vårt team', role: 'Floristerna i butiken', img: IMG.p1 },
      { name: 'Beställningar', role: 'Bukett & binderi', img: IMG.p2 },
    ],
    stats: [
      ['Dagsfärskt', 'varje leverans'],
      ['Handbundet', 'av floristen'],
      ['Lokalt', 'hämtning & bud'],
    ],
    // goal-57 körning 13-fälten: Paisleys egna sektionsrubriker (fallbacks i
    // PaisleyLayout.tsx om owner inte satt något via settings.copy).
    shopEyebrow: '— Ur butiken',
    shopTitle: 'Beställ något vackert',
    shopCta: 'Handla i butiken',
    blogEyebrow: '— Från redaktionen',
    blogTitle: 'Säsong, tips & inspiration',
    blogCta: 'Läs hela bloggen',
    giftEyebrow: '— Presentkort',
    giftLede: 'Ge bort en bukett, när som helst på året.',
    giftCta: 'Till presentkorten',
    closingTitle: 'Redo för din beställning?',
    closingLede: 'Beställ ett arrangemang, boka en tid eller kom förbi butiken.',
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: false, homeAbout: true },
}
