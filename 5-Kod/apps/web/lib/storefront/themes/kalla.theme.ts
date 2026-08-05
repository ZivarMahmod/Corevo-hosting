import { unsplashPhoto, type StorefrontThemeDefinition } from './types'

// Foto-id:n kommer från mallens designpaket och ingår i acceptanskanon.
const IMG = {
  behandlingsrummet: unsplashPhoto('1544161515-4ab6ce6db874'), // hemmets 21:9-band ("Behandlingsrummet")
  storaRummet: unsplashPhoto('1560066984-138dadb4c035'), // om-sektionens 5:4-foto på hemmet
  vilan: unsplashPhoto('1540555700478-4be289fbecef'),
  vantrummet: unsplashPhoto('1618221195710-dd6b41faaea6'),
  detalj: unsplashPhoto('1616486338812-3dadae4b4ace'), // "Detalj — ek & lin"
  ritualhyllan: unsplashPhoto('1586023492125-27b2c045efd7'),
  omPortratt: unsplashPhoto('1508214751196-bcfd4ca60f91'), // om-sidans 4:5-foto
} as const

/**
 * KÄLLA — hårspa och frisör (designpaketet).
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
export const kalla: StorefrontThemeDefinition = {
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
    {
      name: 'shopEyebrow',
      label: 'Apoteket: eyebrow',
      default: 'Det vi använder i behandlingarna',
    },
    { name: 'shopTitle', label: 'Apoteket: rubrik', default: 'Apoteket' },
    { name: 'shopCta', label: 'Apoteket: länktext', default: 'Till apoteket' },
    { name: 'blogTitle', label: 'Anteckningar: rubrik', default: 'Anteckningar' },
    { name: 'blogCta', label: 'Anteckningar: länktext', default: 'Alla →' },
    // Rummet och Ritualklubben använder designens ordagranna fallback.
    // Galleriets eyebrow är i filen salongens ADRESS ("Bondegatan 11") — den är kundens
    // fakta, inte mallens, så defaulten är tom och raden visas bara när ägaren fyllt i den.
    {
      name: 'galleryEyebrow',
      label: 'Rummet: eyebrow',
      hint: 'T.ex. gatuadressen. Visas bara om du fyller i den.',
      default: '',
    },
    { name: 'galleryTitle', label: 'Rummet: rubrik', default: 'Rummet' },
    {
      name: 'clubEyebrow',
      label: 'Ritualklubben: eyebrow',
      default: 'Månadsvis · Ingen bindningstid',
    },
    { name: 'clubTitle', label: 'Ritualklubben: rubrik', default: 'Ritualklubben' },
    {
      name: 'clubLede',
      label: 'Ritualklubben: text',
      rows: 2,
      default: 'Håret mår bäst av regelbundenhet. Välj en rytm — pausa när livet vill annat.',
    },
  ],
}
