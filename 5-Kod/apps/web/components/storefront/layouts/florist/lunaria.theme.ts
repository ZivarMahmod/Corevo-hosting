import type { FloristTheme } from './types'
import { LunariaNav, LunariaFooter } from './lunaria.chrome'
import { LunariaOm, LunariaTjanster, LunariaKontakt } from './lunaria.pages'
import { LunariaShop, LunariaBlogg } from './lunaria.modules'

// Foto-id:n verifierade i två steg (2026-07-11): curl -sI → 200 OCH öppnade som
// bild — bort-sorterade träffar under vägen: en himmel-gradient, en pall, en
// solros, ett par sneakers, tvättomat, bonsai, hjärt-bokeh, stjärnhimmel över
// berg, en gata i Wien, ett hus i skymning, en kaktus och en tulpan på rosa
// botten. Bara genuint florist-passande foton i den dova nattblå/torkat-vete-
// paletten användes nedan.
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  duskRoses: u('1516617442634-75371039cb3a'), // rosor + eukalyptus mot dov skiffer-blå botten — SIGNATUR
  noirRoses: u('1766255081512-ff81e82f656c'), // djupröda rosor mot nästan svart grönt
  whiteRoseWood: u('1766226763084-042674e06791'), // vit ros mot mörkt trä
  eucalyptus: u('1723726649556-88dfed48723a'), // silvergrön eukalyptuskvist, vit botten
  wheatField: u('1556216583-cb1ac9559189'), // torkat vete-fält i skymningsljus
  roseVaseMauve: u('1648112832533-55f654d14bc7'), // enstaka ros i glas, kvällsskugga
  pastelBouquet: u('1606645685534-67c8c5b13f10'), // vit/creme/rosa bukett i vas
  shopStall: u('1596411753943-c760174f79f5'), // blomsterstånd, verkstadskänsla
  pinkLily: u('1711919529153-aff395cb268d'), // rosa lilja i vas
  p1: u('1765252629719-8c7466cb21e5', 700),
  p2: u('1563266589-33a3065a6501', 700),
  p3: u('1661768817921-cdf48ae45b4f', 700),
} as const

/**
 * LUNARIA — nattblå + silvergrå + torkat vete, stillsam (florist-sviten,
 * goal-58). EGET formspråk bland florist-sviten: en hero-bild med en
 * ÖVERLAPPANDE textplatta som skjuter ut över bildens nedre kant (offset-kort,
 * se .lnHeroCard), en måne-ornament som delare, tre "stämningskort" (Säsong /
 * Prenumeration / Kurser — mittenkortet länkar till /shop, sista alltid till
 * /kurser), ett cirkulärt porträtt i om-sektionen och en helbild-closing med
 * mörk gradient. Se LunariaLayout.tsx för hela sektionsordningen.
 */
export const lunaria: FloristTheme = {
  key: 'lunaria',
  name: 'Lunaria',
  desc: 'Nattblå & torkat vete · stillsam',
  // SKÄRPE-PASS 2026-07-11 (design-skarpa-zentum.md, regel 6): kulören är orörd
  // (nattblå 220° + torkat vete 40°) — bara ljusheten justerad tills WCAG håller.
  // Uträknat, inte gissat:
  //   fg   #1C1B18 → 14.85:1 mot bg · 16.49:1 mot surface   (rubrik, krav ≥7)
  //   fg2  #5F5B52 →  5.83:1 mot bg ·  6.48:1 mot surface ·  5.09:1 mot
  //        accent-soft (= .sfRow:hover-ytan). Var #6E6A60: 4.06:1 mot accent-soft
  //        → UNDER 4.5-kravet så fort en tjänsterad hovrades. Nu klarar brödtexten
  //        varje yta den kan hamna på.
  //   primary #1E2A42 → 13.72:1 mot surface (eyebrow/länkar) · knapptexten är
  //        surface (INTE ett eget #ffffff — det var en 9:e färg och paletten ska
  //        rymmas i 8): surface på primary = 13.72:1 · på primary-d = 16.64:1
  //        (hover) · primary-d på surface-fyllningen (closing-CTA) = 16.64:1.
  //   surface på closing-scrimmen håller 7.39:1 även om kunden laddar upp ett
  //        HELVITT foto (scrim = primary-d @0.75 → #4D5360).
  palette: {
    primary: '#1E2A42',
    primaryD: '#121A2B',
    bg: '#F1EEE6',
    surface: '#FBFAF6',
    fg: '#1C1B18',
    fg2: '#5F5B52',
    line: '#DAD4C5',
    accentSoft: '#E8DFC7',
  },
  fonts: {
    display: 'var(--font-italiana), Georgia, serif',
    body: 'var(--font-source-sans), system-ui, sans-serif',
  },
  // BINÄR RADIE (regel 6): 0 på ALL struktur (kort, bilder, hero-platta, karta).
  // Full pill finns bara på knappen (radie = halva höjden) och eyebrow-chippet —
  // medvetna undantag. Det gamla 8px-hörnet på allt var själva "moroten".
  radius: '0px',
  content: {
    heroEyebrow: '— Blommor i stillhet',
    heroTitle: 'Blommor för\nstilla stunder',
    heroLede:
      'Handbundna kompositioner i dova toner — som en sen kväll, en tyst trädgård. Vi väljer det som är vackert just nu, och låter det få ta plats.',
    tagline: 'Blommor för stilla stunder',
    utility: 'Beställ online · Hämta i butik eller få hem levererat',
    italic: 'Även det som vissnar kan vara vackert.',
    aboutCopy:
      'Vi är en blomsterhandel för dig som uppskattar det stillsamma — dova färger, torkade grenar och blommor som får ta sin egen tid. Varje komposition binds för hand, med lika mycket omsorg om formen som om känslan i rummet.',
    servicesEyebrow: '— Vad vi gör',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Stillsamt hantverk, ärliga blommor',
    teamEyebrow: '— Teamet',
    teamTitle: 'Handen bakom kompositionerna',
    heroImages: [IMG.duskRoses, IMG.noirRoses, IMG.whiteRoseWood],
    // [0..2] dubblar som stämningskortens bilder (Säsong/Prenumeration/Kurser) —
    // samma återanvändningsmönster som Flora/Sage: en tenants egna galleri-foton
    // slår igenom även i kort-trion, ingen separat okopplad bild-uppsättning.
    galleryImages: [
      IMG.wheatField,
      IMG.pastelBouquet,
      IMG.shopStall,
      IMG.eucalyptus,
      IMG.roseVaseMauve,
      IMG.pinkLily,
    ],
    aboutImage: IMG.p2,
    closingImage: IMG.noirRoses,
    team: [
      { name: 'Vårt team', role: 'Florister', img: IMG.p1 },
      { name: 'Bukett & design', role: 'Handbundna kompositioner', img: IMG.p3 },
      { name: 'Butik & rådgivning', role: 'Personlig service', img: IMG.p2 },
    ],
    stats: [
      ['100%', 'handbundet'],
      ['Dova', 'toner'],
      ['Stilla', 'hantverk'],
    ],
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: true },
  // goal-59 TEMA-PAKET: Lunaria äger HELA sajten — sidhuvud (sido-rail: stort wordmark
  // + meny i kolumn bakom en silverlinje), sidfot (nattblå platta med stjärn-ornament)
  // och undersidorna (offset-uppslag /om, lugn lista med stora tal /tjanster,
  // överlappande kort /kontakt). Funktionen (NavShell, korg, konto, modul-gatade
  // länkar, Bookable) är fortfarande plattformens.
  chrome: { Nav: LunariaNav, Footer: LunariaFooter },
  pages: { om: LunariaOm, tjanster: LunariaTjanster, kontakt: LunariaKontakt },
  // goal-59 MODUL-VYER: butiken och bloggen renderas i Lunarias formspråk
  // (offset-grid med stora display-priser · överlappande textplattor). Modulen
  // äger fortfarande funktionen: AddToCart, livscykel (paused), priser via
  // formatShopPrice, leveranslöftet via fulfilmentPromise.
  moduleViews: { shop: LunariaShop, blogg: LunariaBlogg },
  // goal-61 editor-paritet: mallens redigerbara element utöver de generella korten.
  // default = layoutens inbyggda fallback-sträng VERBATIM (LunariaLayout.tsx).
  // OBS: shop-/blog-fälten läses även av modul-vyerna (lunaria.modules.tsx) med
  // andra fallbacks (shopEyebrow = template-literal med leveranssätt, shopTitle
  // 'Handla hos oss', shopCta 'Visa hela butiken') — defaulten här är HEM-bandens
  // statiska strängar, samma mönster som calytrix/aurora.
  extraHome: [
    { name: 'pillar1Title', label: 'Stämningskort 1: rubrik', default: 'Säsongens blommor' },
    { name: 'pillar1Body', label: 'Stämningskort 1: text', rows: 2, default: 'Vi följer årstiderna — från vårens första lökar till vinterns torkade grenar. Fråga oss vad som är vackrast just nu.' },
    { name: 'pillar2Title', label: 'Stämningskort 2: rubrik', default: 'Blomprenumeration' },
    { name: 'pillar2Body', label: 'Stämningskort 2: text', rows: 2, default: 'Nya, säsongsbundna kompositioner — levererade eller redo att hämta varje vecka, varannan vecka eller en gång i månaden.' },
    { name: 'pillar2Link', label: 'Stämningskort 2: länktext', default: 'Bli prenumerant' },
    { name: 'pillar3Title', label: 'Stämningskort 3: rubrik', default: 'Kurser & kvällar' },
    { name: 'pillar3Body', label: 'Stämningskort 3: text', rows: 2, default: 'Lär dig binda din egen komposition tillsammans med oss — en stilla kväll med blommor, bubbel och nya bekantskaper.' },
    { name: 'pillar3Link', label: 'Stämningskort 3: länktext', default: 'Se kurser' },
    { name: 'shopEyebrow', label: 'Butiks-bandet: eyebrow', default: '— Ur butiken' },
    { name: 'shopTitle', label: 'Butiks-bandet: rubrik', default: 'Nytt i butiken' },
    { name: 'shopCta', label: 'Butiks-bandet: knapptext', default: 'Till butiken' },
    { name: 'blogEyebrow', label: 'Blogg-bandet: eyebrow', default: '— Från bloggen' },
    { name: 'blogTitle', label: 'Blogg-bandet: rubrik', default: 'Tankar & säsong' },
    { name: 'blogCta', label: 'Blogg-bandet: knapptext', default: 'Läs hela bloggen' },
    { name: 'giftEyebrow', label: 'Presentkort-raden: eyebrow', default: '— Presentkort' },
    { name: 'giftLede', label: 'Presentkort-raden: text', default: 'Ge bort en stilla, blommande stund.' },
    { name: 'giftCta', label: 'Presentkort-raden: länktext', default: 'Till presentkorten' },
    { name: 'galleryEyebrow', label: 'Galleri: eyebrow', default: '— Galleri' },
    { name: 'findEyebrow', label: 'Plats-sektionen: eyebrow', default: '— Hitta till butiken' },
  ],
}
