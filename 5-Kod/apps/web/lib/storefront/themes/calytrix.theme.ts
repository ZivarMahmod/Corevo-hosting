import { unsplashPhoto, type StorefrontThemeDefinition } from './types'

// Foto-id:n LYFTA ur .dc.html — INTE utbytta, inte "liknande".
const IMG = {
  hero: unsplashPhoto('1487530811176-3780de880c2d'), // filens split-hero (höger spalt)
  about: unsplashPhoto('1526047932273-341f2a7631f9'), // filens "Butiken, alltid öppen"-foto
  closing: unsplashPhoto('1520179737749-b7752f6f56fb'), // filens closing-band
  om: unsplashPhoto('1495231916356-a86217efff12'), // filens /om-foto
  // Filens galleri, i dess ordning.
  g1: unsplashPhoto('1612351641432-20a0f196086c', 900),
  g2: unsplashPhoto('1602934585418-f588bea4215c', 900),
  g3: unsplashPhoto('1596309322315-da9e713cbb22', 900),
  g4: unsplashPhoto('1487530811176-3780de880c2d', 900),
  g5: unsplashPhoto('1520179737749-b7752f6f56fb', 900),
  g6: unsplashPhoto('1518343161123-c7e9ab4dc4da', 900),
  g7: unsplashPhoto('1596238276574-b3e8d40fbafb', 900),
  g8: unsplashPhoto('1557982780-d68d843c32ab', 900),
} as const

/**
 * CALYTRIX — e-handel (designpaketet "Calytrix - E-handel.dc.html").
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
export const calytrix: StorefrontThemeDefinition = {
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
  // Manifestets navrad är 68/56px. Calytrix har dessutom en egen annonsrad i samma
  // fixerade toppkluster, så shellOffset reserverar hela 104/94px utan att förvanska
  // det katalogvärde som Design Center och manifestet jämför.
  navHeight: { desktop: '68px', mobile: '56px' },
  shellOffset: { desktop: '104px', mobile: '94px' },
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
    italic: 'Färskhetsgarantin är enkel: håller inte buketten en vecka får du en ny.',
    aboutCopy:
      'Bakom varje order står en florist som väljer, binder och packar för hand. Sortimentet online är exakt det som står i butiken — inget lager, inga gamla blommor.',
    aboutTitle: 'Butiken, alltid öppen',
    servicesEyebrow: 'Leverans',
    servicesTitle: 'Leverans',
    teamEyebrow: 'Om butiken',
    teamTitle: 'Vi packar din beställning',
    // Hero använder about-fotot. Calytrix delade tidigare foto med Flora;
    // kundmallen (Hantverksfloristerna), som är live. Ordningen i Calytrix egen bank
    // är mallägd, och mallväljaren
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
  caps: { heroEyebrow: true, homeStats: false, homeGallery: true, homeAbout: true },
  // Designens bekräftelse skriver ordernumret som "#C48213".
  // Siffrorna är plattformens löpnummer; prefixet är mallens.
  orderPrefix: '#C',
  ownsCopy: true,
  // Mallens redigerbara element använder layoutens inbyggda
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
    // Galleriet och klubben använder designens ordagranna fallback.
    { name: 'galleryTitle', label: 'Galleri: rubrik', default: 'Galleri' },
    {
      name: 'galleryLede',
      label: 'Galleri: underrubrik',
      rows: 2,
      default: 'Senaste leveranserna ur butiken — uppdateras varje vecka.',
    },
    { name: 'clubTitle', label: 'Club: rubrik', default: 'Calytrix Club' },
    {
      name: 'clubLede',
      label: 'Club: text',
      rows: 2,
      hint: 'Tom = klubbens egen "perkText" ur modulinställningarna.',
      default: '1 krona = 1 poäng på allt du handlar. Poängen blir rabatt — och nivåerna ger mer.',
    },
    { name: 'clubCta', label: 'Club: knapptext', default: 'GÅ MED GRATIS' },
  ],
}
