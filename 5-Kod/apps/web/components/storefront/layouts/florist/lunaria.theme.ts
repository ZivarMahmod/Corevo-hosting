import type { FloristTheme } from './types'

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
  noirRoses: u('1494972308805-463bc619d34e'), // djupröda rosor mot nästan svart grönt
  whiteRoseWood: u('1495231916356-a86217efff12'), // vit ros mot mörkt trä
  eucalyptus: u('1533038590840-1cde6e668a91'), // silvergrön eukalyptuskvist, vit botten
  wheatField: u('1500382017468-9049fed747ef'), // torkat vete-fält i skymningsljus
  roseVaseMauve: u('1518895949257-7621c3c786d7'), // enstaka ros i glas, kvällsskugga
  pastelBouquet: u('1591886960571-74d43a9d4166'), // vit/creme/rosa bukett i vas
  shopStall: u('1487070183336-b863922373d4'), // blomsterstånd, verkstadskänsla
  pinkLily: u('1502977249166-824b3a8a4d6d'), // rosa lilja i vas
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1438761681033-6461ffad8d80', 700),
  p3: u('1573497019940-1c28c88b4f3e', 700),
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
  palette: {
    primary: '#1E2A42',
    primaryD: '#121A2B',
    bg: '#F1EEE6',
    surface: '#FBFAF6',
    fg: '#1C1B18',
    fg2: '#6E6A60',
    line: '#DAD4C5',
    accentSoft: '#E8DFC7',
  },
  fonts: {
    display: 'var(--font-italiana), Georgia, serif',
    body: 'var(--font-source-sans), system-ui, sans-serif',
  },
  radius: '8px',
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
}
