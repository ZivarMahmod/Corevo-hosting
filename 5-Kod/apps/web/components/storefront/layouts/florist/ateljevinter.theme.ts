import type { FloristTheme } from './types'
import { AteljeVinterNav, AteljeVinterFooter } from './ateljevinter.chrome'
import { AteljeVinterOm, AteljeVinterTjanster, AteljeVinterKontakt } from './ateljevinter.pages'
import {
  AteljeVinterShop,
  AteljeVinterBlogg,
  AteljeVinterGalleri,
  AteljeVinterLojalitet,
  AteljeVinterOffert,
  AteljeVinterPresentkort,
  AteljeVinterKurser,
} from './ateljevinter.modules'

// Foto-id:n LYFTA ur .dc.html (rawProducts/galleryItems) — inte utbytta, inte "liknande".
// HANDOFF.md §2 regel 4: "Bildbanken är verifierad. Byt inte Unsplash-ID:n mot slumpbilder."
const u = (id: string, w = 1400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  eucalyptus: u('1533038590840-1cde6e668a91'), // nr 01 — eukalyptus, ensam (hero i filen)
  orchid: u('1454262041357-5d96f50a2f27'), // nr 02 — vit orkidé
  stilla: u('1563241527-3004b7be0ffd'), // nr 03 — stilla arrangemang (om-fotot i filen)
  ranunkel: u('1747226757800-6d8f87cfc0fe'), // nr 04 — ranunkel, sju stjälkar
  vitRos: u('1495231916356-a86217efff12'), // nr 05 — vit ros, singulär
  manadensVerk: u('1522748906645-95d8adfd52c7'), // nr 06 — månadens verk
} as const

/**
 * ATELJÉ VINTER — galleri-minimal (goal-64, Claude Design-paketet).
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
export const ateljevinter: FloristTheme = {
  key: 'ateljevinter',
  name: 'Ateljé Vinter',
  desc: 'Galleri-minimal · blommor som objekt',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#6F7D6E',
    primaryD: '#5A6659',
    bg: '#FBFBF9',
    surface: '#F3F3EE',
    fg: '#161616',
    fg2: '#8B8B85',
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
    galleryImages: [IMG.ranunkel, IMG.manadensVerk, IMG.orchid, IMG.stilla, IMG.vitRos, IMG.eucalyptus],
    aboutImage: IMG.stilla,
    closingImage: IMG.manadensVerk,
    team: [],
    stats: [],
  },
  caps: { heroEyebrow: true, homeStats: false, homeGallery: true, homeAbout: true },
  chrome: { Nav: AteljeVinterNav, Footer: AteljeVinterFooter },
  pages: { om: AteljeVinterOm, tjanster: AteljeVinterTjanster, kontakt: AteljeVinterKontakt },
  // goal-64: arkivet + vänkretsen. INGEN team-vy — Ateljé Vinter har inget team i sitt
  // paket (ateljén är EN person), och en påhittad team-sida vore en påhittad personal.
  moduleViews: {
    shop: AteljeVinterShop,
    blogg: AteljeVinterBlogg,
    galleri: AteljeVinterGalleri,
    lojalitet: AteljeVinterLojalitet,
    // goal-64 (regression): beställningsverk-sidan äger nu sin form i stället för att
    // falla till OffertSection (grått band, boxade fält, grön knapp).
    offert: AteljeVinterOffert,
    // goal-64 (regression): gåvobrev-sidan äger sitt kort + köpknapp i stället för
    // PresentkortSection.
    presentkort: AteljeVinterPresentkort,
    // goal-64 (regression): seminarie-listan äger sina rader + anmälan i stället för
    // den delade kurs-sidan (grått hero-band, boxade fält, grön "Anmäl").
    kurser: AteljeVinterKurser,
  },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens inbyggda fallback VERBATIM
  // (AteljeVinterLayout.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'pillar1Title', label: 'Rum i: rubrik', default: 'ateljébesök' },
    { name: 'pillar1Body', label: 'Rum i: text', rows: 2, default: 'en timme, två stolar, era idéer om bröllop eller beställningsverk.' },
    { name: 'pillar2Title', label: 'Rum ii: rubrik', default: 'seminarier' },
    { name: 'pillar2Body', label: 'Rum ii: text', rows: 2, default: 'fyra platser per tillfälle. ett tema, två timmar, inga genvägar.' },
    { name: 'pillar3Title', label: 'Rum iii: rubrik', default: 'arkivet' },
    { name: 'pillar3Body', label: 'Rum iii: text', rows: 2, default: 'tidigare samlingar, dokumenterade innan de lämnade huset.' },
    { name: 'shopEyebrow', label: 'Samlingen: numrering', default: '01 — 06' },
    { name: 'shopTitle', label: 'Samlingen: rubrik', default: 'ur samlingen' },
    { name: 'shopCta', label: 'Samlingen: länktext', default: 'se hela samlingen →' },
    { name: 'blogEyebrow', label: 'Anteckningar: eyebrow', default: 'rum iv' },
    { name: 'blogTitle', label: 'Anteckningar: rubrik', default: 'anteckningar' },
    { name: 'blogCta', label: 'Anteckningar: länktext', default: 'läs alla anteckningar →' },
    { name: 'galleryEyebrow', label: 'Statement: eyebrow', default: 'ateljéns hållning' },
    // goal-64: arkivet + vänkretsen. default = vyns inbyggda fallback VERBATIM.
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
    { name: 'clubNote', label: 'Vänkretsen: fotnot', hint: 'Visas bara om du fyller i den.', default: '' },
  ],
}
