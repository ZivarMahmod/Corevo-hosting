import type { FloristTheme } from './types'
import { SageNav, SageFooter } from './sage.chrome'
import { SageOm, SageTjanster, SageKontakt } from './sage.pages'
import { SageShop, SageBlogg } from './sage.modules'

// Foto-id:n verifierade med curl -sI → 200 OCH öppnade som bild (2026-07-11) —
// bort-sorterade träffar under vägen: lökar, Spider-Man, en kameraväska, en
// laxrätt, tygtextur, en klädbutik och ett arkitektur-foto (samma Unsplash-slug
// betyder INTE samma motiv). Bara genuint blomster-/florist-relaterade foton
// användes nedan.
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  shopStall: u('1487070183336-b863922373d4'), // blomsterstånd, varma toner
  poppyField: u('1465146344425-f00d5f5c8f07'), // vallmo/vete, luftigt
  pastelBouquet: u('1591886960571-74d43a9d4166'), // rosa/creme bukett i vas
  bestsellers: u('1533616688419-b7a585564566'), // orange/röd bukett i glasburk
  birthday: u('1519378058457-4c29a0a2efac'), // klarröda blommor, festligt
  wedding: u('1519225421980-715cb0215aed'), // dukat bröllopsbord m. blombuketter
  whiteRose: u('1495231916356-a86217efff12'), // vit ros på trä, varmt ljus
  pinkLily: u('1502977249166-824b3a8a4d6d'), // rosa lilja i vas
  darkRoses: u('1494972308805-463bc619d34e'), // mörkröda rosor, mättat
  roseVase: u('1518895949257-7621c3c786d7', 900), // enstaka ros i vas, kvällsljus
  sunflower: u('1470509037663-253afd7f0f51', 1400), // solros
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1438761681033-6461ffad8d80', 700),
  p3: u('1573497019940-1c28c88b4f3e', 700),
} as const

/**
 * SAGE — varmgrå/greige + mjuk salvia, luftig studio (goal-58). EGET
 * formspråk bland florist-sviten: transparent nav över en full-bleed hero med
 * versaler, en centrerad välkomstrad, en inramad kategori-trio som länkar till
 * butiken, och genomgående RAKA kanter (--sf-radius 0) — se SageLayout.tsx för
 * sektionsordningen.
 *
 * SKÄRPE-PASS (design-skarpa-zentum.md): identiteten (greige/olivfamiljen, EN
 * accent, sektionsordningen) är orörd — utförandet är skärpt:
 *
 *  · KONTRAST (räknad WCAG, ej ögonmått). primary/primaryD låg i den mjuka
 *    3–4:1-zonen och suddade ut varenda etikett/knapp. Samma kulör (HSL 45°,
 *    22% mättnad — oförändrad), bara ljusheten ned: 40% → 25% (primary) och
 *    29% → 18% (primaryD).
 *      primary #4E4732 på bg #F4F0E8 ....... 8.13:1  (var 4.26:1 ✗)
 *      primary på accentSoft #E9E2CF ....... 7.15:1  (var 3.75:1 ✗ — citatet)
 *      vit knapptext på primary ............ 9.25:1  (var 4.84:1, nätt och jämnt)
 *      vit text på closing-bandet .......... 9.25:1
 *    fg #2B2820 (12.95:1) och fg2 #6E6656 (5.0:1) uppfyllde redan kraven
 *    (rubrik ≥7, brödtext ≥4.5) och lämnas — fg2 ska backa för rubriken.
 *
 *  · FÄRGANTAL. Regeln är max 8 hex TOTALT (vitt inräknat, som i Zentums egen
 *    lista). Paletten var 8 egna hex + #fff (vit text på hero-fotot och på
 *    closing-bandet) = 9. Den nionde var i praktiken en dubblett: surface #FBF9F4
 *    låg 2 % från bg #F4F0E8 — två varma tinter som ögat läser som samma yta, dvs
 *    ingen verklig nivåskillnad mellan sida och kort. surface är nu #FFFFFF: 8 hex
 *    totalt, och korten/välkomstbandet får ett RIKTIGT steg mot den greige sidan.
 *      fg #2B2820 på surface ... 14.72:1   primary på surface ... 9.25:1
 *      fg2 #6E6656 på surface .. 5.68:1    (backar fortfarande för rubriken)
 *
 *  · RADIE binärt. 6px = "morot"-zonen (mjuka kuddar, inga raka linjer kvar att
 *    linjera mot). --sf-radius är nu 0 för ALL struktur (kort, bilder, ramar,
 *    galleri, karta). Knapparna är det enda medvetna undantaget: full pill
 *    (--radius-pill), se sage.module.css .sgPillCta.
 *
 *  · TYPSNITT. Marcellus laddas som ENDA vikt 400 (app/layout.tsx) — mallens
 *    gamla font-weight 700 på hero/rubriker var alltså syntetisk fetstil
 *    (faux bold), precis den klumpiga stora texten regelboken varnar för.
 *    Display kör nu 400/500 rakt igenom; Source Sans 3 (variabel) bär 600 på
 *    all mikrotext på riktigt.
 */
export const sage: FloristTheme = {
  key: 'sage',
  name: 'Sage',
  desc: 'Greige & salvia · luftig studio',
  palette: {
    primary: '#4E4732',
    primaryD: '#383324',
    bg: '#F4F0E8',
    // #FFFFFF, inte en tredje varm tint: se FÄRGANTAL ovan (8 hex totalt).
    surface: '#FFFFFF',
    fg: '#2B2820',
    fg2: '#6E6656',
    line: '#DFD6C4',
    accentSoft: '#E9E2CF',
  },
  fonts: {
    display: 'var(--font-marcellus), Georgia, serif',
    body: 'var(--font-source-sans), system-ui, sans-serif',
  },
  radius: '0px',
  content: {
    heroEyebrow: 'Skön stämning',
    heroTitle: 'Blommor med\nomsorg',
    heroLede:
      'Handplockade snittblommor och personligt bundna buketter — för vardagen, festen och stunderna däremellan.',
    tagline: 'Blommor med omsorg, varje dag',
    utility: 'Beställ online · Hämta i butik eller få hem levererat',
    italic: 'Blommor är det vackraste sättet att säga något viktigt.',
    aboutCopy:
      'Vi är en blomsterbutik för dig som uppskattar hantverk och kvalitet. Varje bukett binds för hand, med blommor vi själva skulle vilja få. Välkommen in — vi hjälper dig gärna hitta rätt, oavsett anledning.',
    servicesEyebrow: '— Våra tjänster',
    servicesTitle: 'Det vi gör',
    aboutTitle: 'Hantverk, omtanke och friska blommor',
    teamEyebrow: '— Teamet',
    teamTitle: 'Människorna bakom buketterna',
    heroImages: [IMG.shopStall, IMG.poppyField, IMG.pastelBouquet],
    // [0..2] dubblar som kategori-trions bilder (Mest sålda/Födelsedag/Bröllop) —
    // samma återanvändningsmönster som Flora använder för sina pelare.
    galleryImages: [IMG.bestsellers, IMG.birthday, IMG.wedding, IMG.whiteRose, IMG.pinkLily, IMG.darkRoses],
    aboutImage: IMG.roseVase,
    closingImage: IMG.sunflower,
    team: [
      { name: 'Vårt team', role: 'Florister', img: IMG.p1 },
      { name: 'Bukett & design', role: 'Handbundna buketter', img: IMG.p3 },
      { name: 'Butik & rådgivning', role: 'Personlig service', img: IMG.p2 },
    ],
    stats: [
      ['100%', 'handbundet'],
      ['Säsong', 'i fokus'],
      ['Personlig', 'rådgivning'],
    ],
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: true },
  // goal-61 editor-paritet: mallens EGNA redigerbara element, kartlagda ur
  // SageLayout.tsx + sage.modules.tsx (mönstret "content.<nyckel> ?? fallback").
  // default = layoutens inbyggda fallback-sträng VERBATIM. Namnprefixen shop/blog/gift
  // routar fältet till sin modulflik i SidaStudio; galleryEyebrow/findEyebrow hamnar
  // på Hem-fliken. OBS: shop- och blog-nycklarna läses BÅDE av hemmets band (defaulten
  // nedan, ur SageLayout) och av modulsidan (egen inbyggd text, ur sage.modules) —
  // ett sparat värde styr båda ställena; hint anger modulsidans text där de skiljer sig.
  extraHome: [
    { name: 'shopEyebrow', label: 'Butiks-bandet: eyebrow', default: '— Ur butiken', hint: 'Styr även butikssidans eyebrow (inbyggd text där: — Webshop).' },
    { name: 'shopTitle', label: 'Butiks-bandet: rubrik', default: 'Nyheter från butiken', hint: 'Styr även butikssidans rubrik (inbyggd text där: Butiken).' },
    { name: 'shopCta', label: 'Butiks-bandet: knapptext', default: 'Till hela butiken', hint: 'Styr även butikssidans knapp (inbyggd text där: Visa hela butiken).' },
    { name: 'blogEyebrow', label: 'Blogg-bandet: eyebrow', default: '— Inspiration', hint: 'Styr även bloggsidans eyebrow (inbyggd text där: — Journalen).' },
    { name: 'blogTitle', label: 'Blogg-bandet: rubrik', default: 'Från bloggen' },
    { name: 'blogCta', label: 'Blogg-bandet: knapptext', default: 'Läs fler inlägg', hint: 'Styr även bloggsidans knapp (inbyggd text där: Läs hela bloggen).' },
    { name: 'giftEyebrow', label: 'Presentkort-raden: eyebrow', default: '— Presentkort' },
    { name: 'giftLede', label: 'Presentkort-raden: text', default: 'Ge bort blommor, när som helst.' },
    { name: 'giftCta', label: 'Presentkort-raden: länktext', default: 'Till presentkorten' },
    { name: 'galleryEyebrow', label: 'Galleri: eyebrow', default: '— Galleri' },
    { name: 'findEyebrow', label: 'Plats-sektionen: eyebrow', default: '— Hitta hit' },
  ],
  // goal-59 TEMA-PAKET: Sage äger HELA sajten — sidhuvud (centrerat wordmark,
  // transparent över heron), sidfot (galleri-plakett) och undersidorna (museal /om,
  // tabell-/tjanster, luftig /kontakt). Funktionen (NavShell, korg, konto, modul-gatade
  // länkar, Bookable) är fortfarande plattformens.
  chrome: { Nav: SageNav, Footer: SageFooter },
  pages: { om: SageOm, tjanster: SageTjanster, kontakt: SageKontakt },
  // Modulens funktion är plattformens (AddToCart, priser, livscykel); Sage äger formen:
  // butiken = passepartout-galleri, bloggen = hårlinje-lista. Se sage.modules.tsx.
  moduleViews: { shop: SageShop, blogg: SageBlogg },
}
