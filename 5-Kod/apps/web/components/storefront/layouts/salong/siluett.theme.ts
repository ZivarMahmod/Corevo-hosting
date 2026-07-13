import type { SalongTheme } from './types'
import { SiluettNav, SiluettFooter } from './siluett.chrome'
import { SiluettOm, SiluettTjanster, SiluettKontakt } from './siluett.pages'
import {
  SiluettShop,
  SiluettBlogg,
  SiluettGalleri,
  SiluettLojalitet,
  SiluettTeam,
} from './siluett.modules'
import { SiluettPresentkort } from '../presentkort-views'

// Foto-id:n LYFTA ur .dc.html (hero, om-fotot, galleriet) — inte utbytta, inte "liknande".
// HANDOFF.md §2 regel 4: "Bildbanken är verifierad. Byt inte Unsplash-ID:n mot slumpbilder."
const u = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  hero: u('1509631179647-0177331693ae'), // N°01 — klippning & form (heron i filen)
  salong: u('1560066984-138dadb4c035'), // "Ett magasin du kliver in i." (salongs-fotot)
  portratt: u('1496747611176-843222e1e57c'), // om-fotot i filen (även N°02 i arkivet)
  arkiv3: u('1539109136881-3be0616acf4b'), // N°03 — uppsättning
  arkiv4: u('1503342217505-b0a15ec3261c'), // N°04 — färg
  arkiv5: u('1488161628813-04466f872be2'), // N°05 — editorial
  arkiv6: u('1529139574466-a303027c1d8b'), // N°06 — klipp
} as const

/**
 * SILUETT — modemagasin (goal-64, Claude Design-paketet).
 *
 * EXAKT KOPIA av "Siluett - Modemagasin.dc.html". Palett, typsnitt, radie och navHeight är
 * LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett. Copyn är filens egen,
 * verbatim: mallen säger "kasse" (aldrig "varukorg"), klubben heter "Första raden" och
 * kassan går i steg 01/02/03. De orden ÄR designen.
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan den flaggan hade BRANSCH_COPY lagt
 * salong-branschens generiska hero-text ovanpå "Håret är din siluett." och hela paketet
 * varit osynligt för varje salong-tenant. Ägarens egen text vinner fortfarande.
 */
export const siluett: SalongTheme = {
  key: 'siluett',
  name: 'Siluett',
  desc: 'Modemagasin · porslin, bläck och elviolett',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#6741D9',
    primaryD: '#4E2BBE',
    bg: '#F6F4EF',
    surface: '#FFFFFF',
    fg: '#131313',
    fg2: '#6E685D',
    line: '#E5E0D4',
    accentSoft: '#ECE5FB',
  },
  // Manifestets `fonts`: Bodoni Moda (didone-display) + Schibsted Grotesk (brödtext).
  // Båda laddas via next/font i app/layout.tsx — var(--font-bodoni)/var(--font-schibsted).
  fonts: {
    display: 'var(--font-bodoni), Georgia, serif',
    body: 'var(--font-schibsted), system-ui, sans-serif',
  },
  radius: '0px',
  navHeight: { desktop: '64px', mobile: '56px' },
  content: {
    heroEyebrow: 'Salong för klipp & färg — SS26',
    heroTitle: 'Håret är din siluett.',
    heroLede:
      'Fyra stolar, ett öga för form. Vi klipper det som klär dig — inte det som råkar vara i flödet.',
    tagline: 'Salong för klipp & färg',
    utility: 'Boka en stol · Tis–Lör',
    // Filens "Fyra stolar. Aldrig fler." — statementet under om-texten på hemmet.
    italic: 'Fyra stolar. Aldrig fler.',
    aboutCopy:
      'Siluett öppnade 2016 med en enda idé: klippningen är ett formbeslut. Vi arbetar långsamt, konsulterar länge och skickar aldrig ut någon med ett hår som inte håller i tre månader.',
    aboutTitle: 'Ett magasin du kliver in i.',
    servicesEyebrow: 'Ur prislistan',
    servicesTitle: 'Tre signaturer',
    teamEyebrow: 'Om salongen',
    teamTitle: 'Vid stolarna',
    heroImages: [IMG.hero, IMG.salong, IMG.portratt],
    galleryImages: [IMG.hero, IMG.portratt, IMG.arkiv3, IMG.arkiv4, IMG.arkiv5, IMG.arkiv6],
    aboutImage: IMG.salong,
    closingImage: IMG.portratt,
    // OWNER-ONLY: teamet ritas bara när salongen lagt in sina egna. Inga stock-ansikten.
    team: [],
    stats: [],
  },
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  chrome: { Nav: SiluettNav, Footer: SiluettFooter },
  pages: { om: SiluettOm, tjanster: SiluettTjanster, kontakt: SiluettKontakt },
  // goal-64: Arkivet (galleri), Första raden (lojalitet) och Teamet. Tom personal-lista →
  // team-vyn renderar ingenting (OWNER-ONLY).
  moduleViews: {
    shop: SiluettShop,
    blogg: SiluettBlogg,
    galleri: SiluettGalleri,
    lojalitet: SiluettLojalitet,
    team: SiluettTeam,
    presentkort: SiluettPresentkort,
  },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens inbyggda fallback VERBATIM
  // (SiluettLayout.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'pillar1Title', label: 'Hero-bild: bildtext', default: 'N°01 — Klippning & form' },
    { name: 'pillar1Body', label: 'Hero-bild: säsong', default: 'SS26' },
    { name: 'pillar2Title', label: 'Hero: adressrad', default: 'Drottninggatan 4 · Stockholm · Tis–Lör' },
    { name: 'pillar3Title', label: 'Remsan (ord separerade med ·)', default: 'Klipp · Färg · Balayage · Uppsättning · Vård' },
    { name: 'homeGalleryEyebrow', label: 'Salongen: eyebrow', default: 'Salongen' },
    { name: 'shopEyebrow', label: 'Butiken: eyebrow', default: 'Det vi själva använder vid stolen' },
    { name: 'shopTitle', label: 'Butiken: rubrik', default: 'Butiken' },
    { name: 'shopCta', label: 'Butiken: länktext', default: 'Hela butiken →' },
    { name: 'blogTitle', label: 'Journal: rubrik', default: 'Journal' },
    { name: 'blogCta', label: 'Journal: länktext', default: 'Alla texter →' },
    // goal-64: Arkivet + Första raden. default = vyns inbyggda fallback VERBATIM.
    { name: 'galleryEyebrow', label: 'Arkivet: eyebrow', default: 'Utvalda arbeten · SS26' },
    { name: 'galleryTitle', label: 'Arkivet: rubrik', default: 'Arkivet' },
    { name: 'clubTitle', label: 'Första raden: rubrik', default: 'Första raden' },
    {
      name: 'clubLede',
      label: 'Första raden: text',
      rows: 2,
      default: 'Vår kundkrets med plats längst fram. Gratis att stå med — men kön är verklig.',
    },
    // Designens kort trycker salongens adress. Den är kundens fakta — tom default.
    { name: 'clubNote', label: 'Första raden: kortets underrad', hint: 'T.ex. salong + gata. Visas bara om du fyller i den.', default: '' },
    { name: 'clubCta', label: 'Första raden: knapptext', default: 'Ställ mig på listan' },
  ],
}
