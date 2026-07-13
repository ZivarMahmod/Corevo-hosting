import type { FloristTheme } from './types'
import { CalytrixNav, CalytrixFooter } from './calytrix.chrome'
import { CalytrixOm, CalytrixTjanster, CalytrixKontakt } from './calytrix.pages'
import { CalytrixShop, CalytrixBlogg } from './calytrix.modules'
import { CalytrixProduct } from './calytrix.product'
import { CalytrixCart } from './calytrix.cart'
import { CalytrixCheckout } from './calytrix.checkout'

// Foto-id:n LYFTA ur .dc.html — INTE utbytta, inte "liknande". Lokal u() (ingen
// värde-import från theme-content.ts: den importerar registry.ts som importerar
// denna fil → cirkulär import).
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  hero: u('1487530811176-3780de880c2d'), // filens split-hero (höger spalt)
  about: u('1526047932273-341f2a7631f9'), // filens "Butiken, alltid öppen"-foto
  closing: u('1520179737749-b7752f6f56fb'), // filens closing-band
  om: u('1495231916356-a86217efff12'), // filens /om-foto
  // Filens galleri, i dess ordning.
  g1: u('1612351641432-20a0f196086c', 900),
  g2: u('1602934585418-f588bea4215c', 900),
  g3: u('1596309322315-da9e713cbb22', 900),
  g4: u('1487530811176-3780de880c2d', 900),
  g5: u('1520179737749-b7752f6f56fb', 900),
  g6: u('1518343161123-c7e9ab4dc4da', 900),
  g7: u('1596238276574-b3e8d40fbafb', 900),
  g8: u('1557982780-d68d843c32ab', 900),
} as const

/**
 * CALYTRIX — E-HANDEL (goal-64, Claude Design-paketet "Calytrix - E-handel.dc.html").
 *
 * EXAKT KOPIA. Palett, typsnitt, radie och caps är LYFTA ur filens `#corevo-manifest`-
 * block; copyn är filens egen svenska, verbatim. Identiteten: plommon/vin, kantigt
 * (radie 0 rakt igenom), butiken som hjälte — och 3-stegskassan, som ÄGS av mallen
 * (calytrix.checkout.tsx).
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan flaggan hade BRANSCH_COPY lagt
 * florist-branschens generiska hero-text ovanpå "Beställ blommor idag", och paketet
 * varit osynligt för varje florist-tenant. Ägarens egen text vinner fortfarande.
 */
export const calytrix: FloristTheme = {
  key: 'calytrix',
  name: 'Calytrix',
  desc: 'Renodlad e-handel i plommon och vin.',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
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
  // Manifestets `fonts`: Instrument Serif (display) + Instrument Sans (brödtext).
  // Båda laddas av next/font i app/layout.tsx — ett familjenamn som inte laddas
  // faller tyst till Georgia och gör mallen typografiskt identisk med grannen.
  fonts: {
    display: 'var(--font-instrumentserif), Georgia, serif',
    body: 'var(--font-instrumentsans), system-ui, sans-serif',
  },
  radius: '0px',
  // AVVIKELSE FRÅN MANIFESTET (medvetet, dokumenterad): manifestet säger 68/56px, vilket
  // är höjden på filens NAV-RAD (66px). NavShell är fixed och reserverar HELA det översta
  // klustret — och Calytrix kluster är TVÅ våningar: annonsraden (10+10px + 13.5px text
  // ≈ 38px) OVANPÅ navraden (66px). Sätts 68px lägger navet sig över innehållet (samma
  // fälla som goal-60 fixade). 104/94px = filens egna mått, summerade.
  navHeight: { desktop: '104px', mobile: '94px' },
  // COPY: filens egen svenska, verbatim. Evergreen (mallen används av många kunder):
  // ingen adress, inget årtal, inga betyg.
  content: {
    heroEyebrow: 'Blomsterbutik online',
    heroTitle: 'Beställ blommor\nidag.',
    heroLede:
      'Hela sortimentet finns online. Välj bukett, betala på ett par klick — hämta i butiken eller få det hemlevererat.',
    tagline: 'Färska blommor, snabbt levererade.',
    utility: 'Beställ före kl 14 — levereras samma dag · Fri hämtning i butik · Bud från 79 kr',
    // Filens /om-stycke två.
    italic:
      'Färskhetsgarantin är enkel: håller inte buketten en vecka får du en ny.',
    aboutCopy:
      'Bakom varje order står en florist som väljer, binder och packar för hand. Sortimentet online är exakt det som står i butiken — inget lager, inga gamla blommor.',
    aboutTitle: 'Butiken, alltid öppen',
    servicesEyebrow: 'Leverans',
    servicesTitle: 'Leverans',
    teamEyebrow: 'Om butiken',
    teamTitle: 'Vi packar din beställning',
    // goal-64: hero = about-fotot. Calytrix delade hero-foto (1487530811176) med `flora` —
    // kundmallen (Hantverksfloristerna), som är LIVE och inte får röras. Fotot byts inte ut
    // (HANDOFF §2 regel 4); ordningen i Calytrix egen bank är däremot vår, och mallväljaren
    // visar heroImages[0]. IMG.hero ligger kvar och används fortfarande av layouten.
    heroImages: [IMG.about, IMG.hero, IMG.closing],
    galleryImages: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6, IMG.g7, IMG.g8],
    aboutImage: IMG.about,
    closingImage: IMG.closing,
    // Inga stock-ansikten: filen har inget team-galleri.
    team: [],
    // Filens hero-statrad (Kl 14 · 79 kr · 100%).
    stats: [
      ['Kl 14', 'cut-off samma dag'],
      ['79 kr', 'bud inom stan'],
      ['100%', 'färskhetsgaranti'],
    ],
  },
  // Manifestets `caps`, oförändrade.
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  // Mallen äger sitt sidhuvud (annonsrad + split-nav), sin mörka sidfot och sina
  // undersidor. ownsUtility: CalytrixNav ritar sin EGEN annonsrad ur utilityText —
  // utan flaggan renderar NavShell OCKSÅ plattformens remsa (två staplade rader).
  chrome: { Nav: CalytrixNav, Footer: CalytrixFooter, ownsUtility: true },
  pages: { om: CalytrixOm, tjanster: CalytrixTjanster, kontakt: CalytrixKontakt },
  // Modul-vyerna: modulen äger funktionen (data, livscykel, köp-räls), mallen formen.
  // goal-64: product/cart/checkout deklareras HÄR (inte i route-filernas hårdkodade
  // tabeller) — 3-stegskassan ÄR mallens identitet.
  moduleViews: {
    shop: CalytrixShop,
    blogg: CalytrixBlogg,
    product: CalytrixProduct,
    cart: CalytrixCart,
    checkout: CalytrixCheckout,
  },
  ownsCopy: true,
  // goal-61 editor-paritet: mallens REDIGERBARA element. default = layoutens inbyggda
  // fallback-sträng VERBATIM (CalytrixLayout/pages/modules) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'shopEyebrow', label: 'Mest sålda: eyebrow', default: 'Mest sålda' },
    { name: 'shopTitle', label: 'Mest sålda: rubrik', default: 'Beställ det alla vill ha' },
    { name: 'shopCta', label: 'Mest sålda: länktext', default: 'Visa hela butiken →' },
    { name: 'findEyebrow', label: 'Leveranskoll: eyebrow', default: 'Leveranskoll' },
    { name: 'blogEyebrow', label: 'Blogg-bandet: eyebrow', default: 'Blogg' },
    { name: 'blogTitle', label: 'Blogg-bandet: rubrik', default: 'Nytt från butiken' },
    { name: 'blogCta', label: 'Blogg-bandet: länktext', default: 'Läs hela bloggen →' },
    { name: 'closingTitle', label: 'Closing: rubrik', default: 'Någon blir glad idag.' },
    {
      name: 'closingLede',
      label: 'Closing: text',
      rows: 2,
      default: 'Beställ före kl 14 så levererar vi innan kvällen.',
    },
    { name: 'pillar1Title', label: 'Om: kolumn 1 rubrik', default: 'Floristerna' },
    {
      name: 'pillar1Body',
      label: 'Om: kolumn 1 text',
      rows: 2,
      default: 'Binder varje beställning för hand, samma dag.',
    },
    { name: 'pillar2Title', label: 'Om: kolumn 2 rubrik', default: 'Beställningarna' },
    {
      name: 'pillar2Body',
      label: 'Om: kolumn 2 text',
      rows: 2,
      default: 'Packas svalt och säkert — kortet skrivs för hand.',
    },
    { name: 'pillar3Title', label: 'Om: kolumn 3 rubrik', default: 'Leveransen' },
    {
      name: 'pillar3Body',
      label: 'Om: kolumn 3 text',
      rows: 2,
      default: 'Eget bud i stan, kyld transport i resten av landet.',
    },
  ],
}
