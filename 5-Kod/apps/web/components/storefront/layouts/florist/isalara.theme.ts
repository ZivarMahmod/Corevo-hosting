import type { FloristTheme } from './types'
import { IsalaraNav, IsalaraFooter } from './isalara.chrome'
import { IsalaraOm, IsalaraTjanster, IsalaraKontakt } from './isalara.pages'

// Isalaras egen fotomanifest (Unsplash, verifierade `curl -sI` → 200 2026-07-11,
// samtliga id:n redan visuellt granskade av syskonmallarna som återanvänder dem —
// ingen arkitektur/hund/skor-felträff). Lokal u() — INGEN värde-import från
// theme-content.ts (bara `import type` är tillåtet från delade moduler; en
// värde-import hit skulle skapa en cirkulär import eftersom theme-content.ts
// importerar FLORIST_CONTENT från registry.ts som importerar denna fil).
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  hero1: u('1519378058457-4c29a0a2efac'), // klarröda blommor, festligt
  hero2: u('1596438459194-f275f413d6ff'), // aprikosfärgad bukett på kraftpapper
  hero3: u('1465146344425-f00d5f5c8f07'), // vallmo/vetefält, luftigt
  duo1: u('1494972308805-463bc619d34e'), // mörkröda rosor, mättat — portföljbild 1
  duo2: u('1518895949257-7621c3c786d7'), // ros i vas, kvällsljus — portföljbild 2
  g3: u('1502977249166-824b3a8a4d6d'), // rosa lilja i vas
  g4: u('1470509037663-253afd7f0f51'), // solros/vetefält
  g5: u('1487070183336-b863922373d4'), // blomsterstånd, varma toner
  g6: u('1533616688419-b7a585564566'), // orange/röd bukett i glasburk
  about: u('1466692476868-aef1dfb1e735'), // växthus, arbetsmiljö
  closing: u('1490750967868-88aa4486c946'), // bukett
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1500648767791-00dcc994a43e', 700),
  p3: u('1438761681033-6461ffad8d80', 700),
} as const

/**
 * ISALARA — djupblå/marin + varm sand, elegant kvällskänsla (florist-sviten,
 * goal-58). EGEN sektionsordning (ingen annan mall i sviten har den): (1) hero —
 * bild med en HANDSKRIVEN skript-rubrik (var(--font-script)) centrerad + liten
 * pill-CTA, (2) fyra ikon-genvägar i en ljus rad direkt under heron (Mest sålda/
 * Växter → butiken, Floristens val → offert, Leveransorter → ankare ned till
 * plats-sektionen — var och en gated på sin modul), (3) mörkblått band med en
 * enda rad (content.tagline), (4) TVÅ stora bilder sida vid sida utan mellanrum
 * (portföljkänsla), (5) shop-teasers, (6) tjänster, (7) om, (8) blogg, (9)
 * presentkort (smal rad), (10) plats, (11) closing. Se IsalaraLayout.tsx för
 * sektionerna i sin helhet. Skript-rubriken är signaturen — resten av mallen
 * (sf-h1/sf-h2 m.fl.) körs i en lugn serif (Cormorant) så skriptet aldrig
 * konkurrerar med sig självt.
 */
export const isalara: FloristTheme = {
  key: 'isalara',
  name: 'Isalara',
  desc: 'Djupblå & varm sand · elegant',
  // SKÄRPE-PASS (design-skarpa-zentum.md): paletten är ORÖRD — den klarade redan
  // kraven med marginal (uträknat, inte gissat). 8 hex, EN kall + EN varm familj
  // (marin 210° + sand 40°), accenten = primary och sitter bara på knapp/detalj:
  //   fg      #1C2733 på bg 13.71:1 · på surface 14.88:1   (krav ≥ 7, sikte 11)
  //   fg2     #675E4F på bg  5.78:1 · på surface  6.27:1   (krav ≥ 4.5 — backar medvetet)
  //   primary #1B3B5B → #fff på knapp 11.52:1 · som länk på bg 10.44:1 (krav ≥ 4.5)
  //   #FFFDF7 på primaryD (bandet) 16.39:1 · på primary (closing) 11.32:1
  // Det ENDA kontrastfelet satt i hero-scrimen (ljus text kunde landa på 2.00:1 mot
  // en utbränd fotopixel) — fixat i isalara.module.css, inte i paletten.
  // Dessa 8 ÄR mallens totala färgbudget: scrimen lånar primaryD, så CSS:en har
  // NOLL egna hex-värden. Lägg aldrig till en nionde här eller där.
  palette: {
    primary: '#1B3B5B',
    primaryD: '#0C1F33',
    bg: '#FAF3E6',
    surface: '#FFFDF7',
    fg: '#1C2733',
    fg2: '#675E4F',
    line: '#E6D9C0',
    accentSoft: '#EFE4CC',
  },
  fonts: {
    // Cormorant Garamond levereras i 400/500/600/700 (app/layout.tsx) → mallens
    // display-vikt 500 är en ÄKTA skärning, ingen syntetisk fetstil.
    display: 'var(--font-cormorant), Georgia, serif',
    body: 'var(--font-inter), system-ui, sans-serif',
  },
  // BINÄR radie: 0 på all struktur (kort, bilder, karta, om-foto, genvägar) — knappen
  // är full pill via globala .btn-accent (--radius-pill) och ikoncirkeln kör SAMMA
  // token. EN enda icke-noll-radie i mallen, inget däremellan. 5px på allt var precis
  // den mjuka moroten passet tog bort.
  radius: '0px',
  content: {
    heroEyebrow: '— Blomsterhandel',
    heroTitle: 'Blommor för\nvarje stund',
    heroLede:
      'Handbundna buketter i djupa, omsorgsfulla toner — beställ hem, hämta i butiken eller låt oss föreslå något alldeles eget.',
    tagline: 'Lycka levererad i varje bukett.',
    utility: 'Handbundet varje dag · Leverans till hela vårt område',
    italic: 'En bukett minns det orden glömmer.',
    aboutCopy:
      'Vi är en blomsterhandel som tror på det stillsamma hantverket — varje bukett binds för hand, med säsongens finaste snitt och en känsla för balans i färg och form.',
    servicesEyebrow: '— Beställ & boka',
    servicesTitle: 'Tjänster & priser',
    aboutTitle: 'Hantverk i lugn, mörkblå ton',
    teamEyebrow: '— Floristerna',
    teamTitle: 'Händerna bakom varje bukett',
    heroImages: [IMG.hero1, IMG.hero2, IMG.hero3],
    // [0..1] dubblar som portfölj-duons bilder (islDuo) — [2..5] fyller
    // editorns galleri-fält även om HEM inte kör en egen masonry-sektion
    // (caps.homeGallery: false, samma mönster som paisley).
    galleryImages: [IMG.duo1, IMG.duo2, IMG.g3, IMG.g4, IMG.g5, IMG.g6],
    aboutImage: IMG.about,
    closingImage: IMG.closing,
    team: [
      { name: 'Vårt team', role: 'Florister', img: IMG.p1 },
      { name: 'Beställningar', role: 'Bukett & binderi', img: IMG.p2 },
      { name: 'Butik & rådgivning', role: 'Personlig service', img: IMG.p3 },
    ],
    stats: [
      ['100%', 'handbundet'],
      ['Säsong', 'i fokus'],
      ['Personlig', 'rådgivning'],
    ],
    shopEyebrow: '— Ur butiken',
    shopTitle: 'Beställ något vackert',
    shopCta: 'Visa hela butiken',
    blogEyebrow: '— Från floristen',
    blogTitle: 'Säsong, tips & inspiration',
    blogCta: 'Läs hela bloggen',
    giftEyebrow: '— Presentkort',
    giftLede: 'Ge bort en blomstrande stund.',
    giftCta: 'Till presentkorten',
    findEyebrow: '— Hitta till butiken',
    closingTitle: 'Redo att beställa något vackert?',
    closingLede: 'Handla i butiken, boka en tid eller hör av dig — vi hjälper dig gärna.',
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: false, homeAbout: true },
  // TEMA-PAKET (goal-59): mallen äger HELA sajten, inte bara hemmet. Sidhuvudet är
  // en solid marinblå fullbreddsrad (aldrig transparent), sidfoten en marinblå
  // platta med skript-wordmark + tre kolumner, och /om, /tjanster, /kontakt är
  // komponerade i mallens eget språk (brev · tvåspalt med guld-prick · mörkblått
  // kort) istället för de delade .sf*-sektionerna som gjorde sviten likformig.
  chrome: { Nav: IsalaraNav, Footer: IsalaraFooter },
  pages: { om: IsalaraOm, tjanster: IsalaraTjanster, kontakt: IsalaraKontakt },
}
