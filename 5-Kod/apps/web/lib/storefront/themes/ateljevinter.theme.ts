import { unsplashPhoto, type StorefrontThemeDefinition } from './types'

// Foto-id:n kommer från mallens designpaket och ingår i acceptanskanon.
const IMG = {
  eucalyptus: unsplashPhoto('1533038590840-1cde6e668a91', 1400), // nr 01 — eukalyptus, ensam (hero i filen)
  orchid: unsplashPhoto('1454262041357-5d96f50a2f27', 1400), // nr 02 — vit orkidé
  stilla: unsplashPhoto('1563241527-3004b7be0ffd', 1400), // nr 03 — stilla arrangemang (om-fotot i filen)
  ranunkel: unsplashPhoto('1747226757800-6d8f87cfc0fe', 1400), // nr 04 — ranunkel, sju stjälkar
  vitRos: unsplashPhoto('1495231916356-a86217efff12', 1400), // nr 05 — vit ros, singulär
  manadensVerk: unsplashPhoto('1522748906645-95d8adfd52c7', 1400), // nr 06 — månadens verk
} as const

/**
 * ATELJÉ VINTER — galleri-minimal (designpaketet).
 *
 * EXAKT KOPIA av "Ateljé Vinter - Galleri Minimal.dc.html". Palett, typsnitt, radie och
 * navHeight är LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett. Copyn är
 * filens egen, verbatim, ner till gemenerna: mallen skriver aldrig med versal begynnelse,
 * och den skillnaden ÄR designen.
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan den flaggan hade BRANSCH_COPY lagt
 * florist-branschens generiska hero-text ovanpå "blommor, betraktade som objekt", och hela
 * paketet varit osynligt för varje florist-tenant. Ägarens egen text vinner fortfarande.
 */
export const ateljevinter: StorefrontThemeDefinition = {
  key: 'ateljevinter',
  name: 'Ateljé Vinter',
  desc: 'Galleri-minimal · blommor som objekt',
  // Manifestets `palette`, alla 8 nycklar.
  palette: {
    primary: '#6A7869',
    primaryD: '#5A6659',
    bg: '#FBFBF9',
    surface: '#F3F3EE',
    fg: '#161616',
    fg2: '#73736D',
    line: '#E4E4DE',
    accentSoft: '#B9B9B2',
  },
  // Manifestets `fonts`: Manrope i BÅDE display och brödtext — mallen har ett enda typsnitt,
  // och håller isär rollerna med vikt (300 display / 400-500 UI) i stället för familj.
  fonts: {
    display: 'var(--font-manrope), system-ui, sans-serif',
    body: 'var(--font-manrope), system-ui, sans-serif',
  },
  radius: '0px',
  navHeight: { desktop: '68px', mobile: '56px' },
  content: {
    heroEyebrow: 'samling nr 14 — juli',
    heroTitle: 'blommor,\nbetraktade\nsom objekt',
    heroLede:
      'sex kompositioner per månad. varje verk binds i ett exemplar per beställning, numreras och signeras av ateljén.',
    tagline: 'blommor, betraktade som objekt',
    utility: 'sex verk per månad · binds på beställning',
    // Filens "ateljéns hållning" — statementet på hemmet.
    italic:
      'vi tror att en enda stjälk, rätt placerad, säger mer än sjuttio i cellofan. därför binder vi färre blommor, långsammare.',
    aboutCopy:
      'ateljé vinter drivs av en person, i ett rum med norrljus på kungsholmen. här finns inget kylrum fullt av cellofan — bara ett arbetsbord, en vas för mycket och övertygelsen att blommor förtjänar samma omsorg som vilket hantverk som helst.',
    aboutTitle: 'två händer, ett bord',
    servicesEyebrow: 'på uppdrag',
    servicesTitle: 'beställningsverk',
    teamEyebrow: 'ateljén',
    teamTitle: 'handen bakom verken',
    heroImages: [IMG.eucalyptus, IMG.orchid, IMG.stilla],
    galleryImages: [
      IMG.ranunkel,
      IMG.manadensVerk,
      IMG.orchid,
      IMG.stilla,
      IMG.vitRos,
      IMG.eucalyptus,
    ],
    aboutImage: IMG.stilla,
    closingImage: IMG.manadensVerk,
    team: [],
    stats: [],
  },
  caps: { heroEyebrow: true, homeStats: false, homeGallery: true, homeAbout: true },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens inbyggda fallback VERBATIM
  // (AteljeVinterLayout.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'pillar1Title', label: 'Rum i: rubrik', default: 'ateljébesök' },
    {
      name: 'pillar1Body',
      label: 'Rum i: text',
      rows: 2,
      default: 'en timme, två stolar, era idéer om bröllop eller beställningsverk.',
    },
    { name: 'pillar2Title', label: 'Rum ii: rubrik', default: 'seminarier' },
    {
      name: 'pillar2Body',
      label: 'Rum ii: text',
      rows: 2,
      default: 'fyra platser per tillfälle. ett tema, två timmar, inga genvägar.',
    },
    { name: 'pillar3Title', label: 'Rum iii: rubrik', default: 'arkivet' },
    {
      name: 'pillar3Body',
      label: 'Rum iii: text',
      rows: 2,
      default: 'tidigare samlingar, dokumenterade innan de lämnade huset.',
    },
    { name: 'shopEyebrow', label: 'Samlingen: numrering', default: '01 — 06' },
    { name: 'shopTitle', label: 'Samlingen: rubrik', default: 'ur samlingen' },
    { name: 'shopCta', label: 'Samlingen: länktext', default: 'se hela samlingen →' },
    { name: 'blogEyebrow', label: 'Anteckningar: eyebrow', default: 'rum iv' },
    { name: 'blogTitle', label: 'Anteckningar: rubrik', default: 'anteckningar' },
    { name: 'blogCta', label: 'Anteckningar: länktext', default: 'läs alla anteckningar →' },
    { name: 'homeGalleryEyebrow', label: 'Statement: eyebrow', default: 'ateljéns hållning' },
    // Arkivet och vänkretsen använder designens ordagranna fallback.
    { name: 'galleryEyebrow', label: 'Arkivet: eyebrow', default: 'rum iii' },
    { name: 'galleryTitle', label: 'Arkivet: rubrik', default: 'arkivet' },
    { name: 'clubEyebrow', label: 'Vänkretsen: eyebrow', default: 'vänkretsen' },
    { name: 'clubTitle', label: 'Vänkretsen: rubrik', default: 'först till samlingen' },
    {
      name: 'clubLede',
      label: 'Vänkretsen: text',
      rows: 3,
      default:
        'varje månadssamling släpps till vänkretsen två dagar före alla andra. medlemmar bjuds dessutom till visningskvällen där samlingen presenteras — ett glas, sex verk, inga säljpitchar. kostnadsfritt, alltid.',
    },
    { name: 'clubCta', label: 'Vänkretsen: knapptext', default: 'gå med' },
    // Designens rad är "184 medlemmar · nästa visning 3 augusti" — ett medlemsantal och
    // ett datum vi INTE har. Tom default: raden visas först när ägaren skrivit sin egen.
    {
      name: 'clubNote',
      label: 'Vänkretsen: fotnot',
      hint: 'Visas bara om du fyller i den.',
      default: '',
    },
  ],
}
