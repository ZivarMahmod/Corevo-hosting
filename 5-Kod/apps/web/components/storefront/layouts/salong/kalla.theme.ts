import type { SalongTheme } from './types'
import { KallaNav, KallaFooter } from './kalla.chrome'
import { KallaOm, KallaTjanster, KallaKontakt } from './kalla.pages'
import {
  KallaShop,
  KallaBlogg,
  KallaGalleri,
  KallaLojalitet,
  KallaTeam,
} from './kalla.modules'
import { KallaPresentkort } from '../presentkort-views'

// Foto-id:n LYFTA ur .dc.html (galleryItems/teamData/blog/hero) — inte utbytta, inte
// "liknande". HANDOFF.md §2 regel 4: "Bildbanken är verifierad. Byt inte Unsplash-ID:n."
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  behandlingsrummet: u('1544161515-4ab6ce6db874'), // hemmets 21:9-band ("Behandlingsrummet")
  storaRummet: u('1560066984-138dadb4c035'), // om-sektionens 5:4-foto på hemmet
  vilan: u('1540555700478-4be289fbecef'),
  vantrummet: u('1618221195710-dd6b41faaea6'),
  detalj: u('1616486338812-3dadae4b4ace'), // "Detalj — ek & lin"
  ritualhyllan: u('1586023492125-27b2c045efd7'),
  omPortratt: u('1508214751196-bcfd4ca60f91'), // om-sidans 4:5-foto
} as const

/**
 * KÄLLA — hårspa & frisör (goal-64, Claude Design-paketet).
 *
 * EXAKT KOPIA av "Källa - Hårspa.dc.html". Palett, typsnitt, radie, navHeight och caps är
 * LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett. Copyn är filens egen,
 * verbatim: "ritual", "Apoteket", "Anteckningar", "Ett andrum för ditt hår". De orden ÄR
 * designen; byts de ut är mallen inte längre mallen.
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan flaggan hade BRANSCH_COPY lagt
 * salong-branschens generiska hero-text ovanpå "Ett andrum för ditt hår", och hela paketet
 * varit osynligt för varje salong-tenant. Ägarens egen text vinner fortfarande.
 *
 * TEAM: tomt. Filens Ester/Nour/Vilgot är stock-ansikten — de får ALDRIG visas som om de
 * vore salongens personal. Tom lista → hemmets "Våra händer" ritas inte alls.
 */
export const kalla: SalongTheme = {
  key: 'kalla',
  name: 'Källa',
  desc: 'Hårspa — sand, djup teal och ritualer i lugnt tempo.',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#1D5E54',
    primaryD: '#143F39',
    bg: '#F3EFE7',
    surface: '#FBFAF5',
    fg: '#22302B',
    fg2: '#5F6B60',
    line: '#DAD3C2',
    accentSoft: '#E4EAE3',
  },
  // Manifestets `fonts`: Marcellus i rubriker/priser, Karla i all brödtext och UI.
  fonts: {
    display: 'var(--font-marcellus), Georgia, serif',
    body: 'var(--font-karla), system-ui, sans-serif',
  },
  radius: '8px',
  navHeight: { desktop: '68px', mobile: '56px' },
  content: {
    heroEyebrow: 'Hårspa · Södermalm · Sedan 2021',
    heroTitle: 'Ett andrum\nför ditt hår.',
    heroLede:
      'Vi börjar där håret börjar — i hårbotten. Rening, behandling och klippning i ett rum där ingen har bråttom.',
    tagline: 'Hårspa & frisör',
    utility: 'Varje besök inleds med en kort konsultation · Välkommen in',
    // Filens om-sida, andra stycket — mallens stillsamma statement.
    italic:
      'Vi arbetar med rena, doftlåga produkter, tar emot en gäst i taget per terapeut och serverar alltid te. Telefonen lämnar du gärna i en låda vid dörren.',
    // Hemmets om-platta (filens "Om Källa"-block).
    aboutCopy:
      'Källa öppnade när vi tröttnat på att håret behandlades som en yta. Friskt hår växer ur en frisk hårbotten — därför börjar varje besök med rening och massage, och slutar med ett klipp som håller.',
    aboutTitle: 'Frisören som tänker som ett spa',
    servicesEyebrow: 'Signaturer',
    servicesTitle: 'Tre ritualer',
    teamEyebrow: 'Om Källa',
    teamTitle: 'Våra händer',
    heroImages: [IMG.behandlingsrummet, IMG.storaRummet, IMG.vilan],
    galleryImages: [
      IMG.behandlingsrummet,
      IMG.storaRummet,
      IMG.vilan,
      IMG.vantrummet,
      IMG.detalj,
      IMG.ritualhyllan,
    ],
    aboutImage: IMG.storaRummet,
    closingImage: IMG.ritualhyllan,
    // OWNER-ONLY (se ovan).
    team: [],
    // Filens om-sida: tre sifferrutor, mittersta i teal.
    stats: [
      ['1 gäst', 'i taget, per terapeut'],
      ['90 min', 'är vårt normala besök'],
      ['0 klockor', 'på väggarna. Medvetet.'],
    ],
    // Mall-egna sektionstexter (filens egna strängar) — ägarens settings.copy vinner ändå.
    shopEyebrow: 'Det vi använder i behandlingarna',
    shopTitle: 'Apoteket',
    shopCta: 'Till apoteket',
    blogTitle: 'Anteckningar',
    blogCta: 'Alla →',
    galleryEyebrow: 'Behandlingsrummet',
    contactTitle: 'Kontakt',
  },
  // Manifestets `caps`, oförändrade.
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  chrome: { Nav: KallaNav, Footer: KallaFooter },
  pages: { om: KallaOm, tjanster: KallaTjanster, kontakt: KallaKontakt },
  // goal-64: Rummet (galleri), Ritualklubben (lojalitet) och Terapeuterna (team).
  // Team-vyn renderar INGENTING när kunden inte lagt upp någon personal — aldrig
  // stock-ansikten som om de vore salongens folk.
  moduleViews: {
    shop: KallaShop,
    blogg: KallaBlogg,
    galleri: KallaGalleri,
    lojalitet: KallaLojalitet,
    team: KallaTeam,
    presentkort: KallaPresentkort,
  },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens inbyggda fallback VERBATIM
  // (KallaLayout.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'pillar1Title', label: 'Ritual 01: rubrik', default: 'Rening' },
    {
      name: 'pillar1Body',
      label: 'Ritual 01: text',
      rows: 2,
      default: 'Hårbottenanalys, peeling och massage. Grunden i varje besök.',
    },
    { name: 'pillar2Title', label: 'Ritual 02: rubrik', default: 'Behandling' },
    {
      name: 'pillar2Body',
      label: 'Ritual 02: text',
      rows: 2,
      default: 'Fukt eller protein — håret får det håret saknar, aldrig mer.',
    },
    { name: 'pillar3Title', label: 'Ritual 03: rubrik', default: 'Finish' },
    {
      name: 'pillar3Body',
      label: 'Ritual 03: text',
      rows: 2,
      default: 'Klipp, fön eller bara luft. Du väljer tempot ut.',
    },
    { name: 'homeGalleryEyebrow', label: 'Bandbilden: bildtext', default: 'Behandlingsrummet' },
    { name: 'shopEyebrow', label: 'Apoteket: eyebrow', default: 'Det vi använder i behandlingarna' },
    { name: 'shopTitle', label: 'Apoteket: rubrik', default: 'Apoteket' },
    { name: 'shopCta', label: 'Apoteket: länktext', default: 'Till apoteket' },
    { name: 'blogTitle', label: 'Anteckningar: rubrik', default: 'Anteckningar' },
    { name: 'blogCta', label: 'Anteckningar: länktext', default: 'Alla →' },
    // goal-64: Rummet + Ritualklubben. default = vyns inbyggda fallback VERBATIM.
    // Galleriets eyebrow är i filen salongens ADRESS ("Bondegatan 11") — den är kundens
    // fakta, inte mallens, så defaulten är tom och raden visas bara när ägaren fyllt i den.
    { name: 'galleryEyebrow', label: 'Rummet: eyebrow', hint: 'T.ex. gatuadressen. Visas bara om du fyller i den.', default: '' },
    { name: 'galleryTitle', label: 'Rummet: rubrik', default: 'Rummet' },
    { name: 'clubEyebrow', label: 'Ritualklubben: eyebrow', default: 'Månadsvis · Ingen bindningstid' },
    { name: 'clubTitle', label: 'Ritualklubben: rubrik', default: 'Ritualklubben' },
    {
      name: 'clubLede',
      label: 'Ritualklubben: text',
      rows: 2,
      default: 'Håret mår bäst av regelbundenhet. Välj en rytm — pausa när livet vill annat.',
    },
  ],
}
