import type { FloristTheme } from './types'
import { EloriaNav, EloriaFooter } from './eloria.chrome'
import { EloriaOm, EloriaTjanster, EloriaKontakt } from './eloria.pages'
import { EloriaShop, EloriaBlogg, EloriaGalleri, EloriaLojalitet } from './eloria.modules'

// Foto-id:n LYFTA ur .dc.html (catalog/journal/tiles/galleryItems) — inte utbytta, inte
// "liknande". HANDOFF.md §2 regel 4: "Bildbanken är verifierad. Byt inte Unsplash-ID:n."
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  spreadL: u('1582794543139-8ac9cb0f7b11'), // uppslagets vänstra foto (620px)
  spreadR: u('1454262041357-5d96f50a2f27'), // uppslagets högra foto (540px, 80px nedskjutet)
  tradgardsros: u('1524835391568-32c8f7016d73', 900), // No. I — trädgårdsros
  vitCeremoni: u('1522748906645-95d8adfd52c7', 900), // No. II — vit ceremoni
  sommarang: u('1582874576091-26fa231ce87c', 900), // No. III — sommaräng
  aftonljus: u('1598453055371-0f5e37113bea', 900), // No. IV — aftonljus
  stillaFarval: u('1596309322315-da9e713cbb22', 900), // No. V — stilla farväl
  manadensVal: u('1716982360804-b0bfdb28103e', 900), // No. VI — månadens val
  om: u('1727520327526-4b435667860a'), // om-uppslagets foto
} as const

/**
 * ELORIA — klassiskt magasin (goal-64, Claude Design-paketet).
 *
 * EXAKT KOPIA av "Eloria - Klassiskt Magasin.dc.html". Palett, typsnitt, radie och navHeight
 * är LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett, inget är "nästan".
 * Mörkgrönt bläck (#182A20) mot blush (#FBF3EE), guld (#7A5D1E) som enda accent och en
 * ljusare guldton (#D9BE7B) som bara får finnas på de mörkgröna ytorna: guldramen, remsan,
 * sidfoten. Romerska siffror i katalogen, hårlinjer i stället för kort, radie 0.
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan flaggan hade BRANSCH_COPY lagt
 * florist-branschens generiska hero-text ovanpå husets egen röst ("Det bästa av säsongen,
 * komponerat med omsorg."), och paketet varit osynligt för varje florist-tenant. Ägarens
 * egen settings.copy vinner fortfarande — det ÄR redigeraren.
 */
export const eloria: FloristTheme = {
  key: 'eloria',
  name: 'Eloria',
  desc: 'Klassiskt premium — mörkgrönt, guld och romerska siffror.',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#7A5D1E',
    primaryD: '#5E4715',
    bg: '#FBF3EE',
    surface: '#FFFFFF',
    fg: '#182A20',
    fg2: '#6B5548',
    line: '#E8D9C9',
    accentSoft: '#D9BE7B',
  },
  // Manifestets `fonts`: Cormorant Garamond i displayen (ofta kursiv), Mulish i brödtexten.
  fonts: {
    display: 'var(--font-cormorant), Georgia, serif',
    body: 'var(--font-mulish), system-ui, sans-serif',
  },
  radius: '0px',
  navHeight: { desktop: '68px', mobile: '56px' },
  content: {
    heroEyebrow: 'Livets stora stunder',
    heroTitle: 'Blommor för bröllop, fest och avsked',
    heroLede:
      'Varje arrangemang komponeras personligen, efter samtal med er. Vi tar emot ett begränsat antal uppdrag per helg — förfrågan kostar ingenting.',
    tagline: 'blomsterhandel i klassisk stil',
    utility: 'Leverans samma dag vid beställning innan kl 14 · Handbundet i butik',
    // Filens devis — citat-blocket på hemmet och signaturen i /om.
    italic: 'Det bästa av säsongen, komponerat med omsorg.',
    aboutTitle: 'Det tidlösa hantverket',
    aboutCopy:
      'Vi är en blomsterhandel som tror på det tidlösa — klassiska snitt, ärligt hantverk och buketter som håller vad de lovar. Varje beställning binds för hand av någon som kan sitt hantverk.',
    servicesEyebrow: 'Bröllop & högtid',
    servicesTitle: 'Er dag, våra blommor',
    teamEyebrow: 'Om oss',
    teamTitle: 'Det tidlösa hantverket',
    heroImages: [IMG.spreadL, IMG.spreadR, IMG.tradgardsros],
    galleryImages: [
      IMG.tradgardsros,
      IMG.vitCeremoni,
      IMG.sommarang,
      IMG.aftonljus,
      IMG.stillaFarval,
      IMG.manadensVal,
    ],
    aboutImage: IMG.om,
    closingImage: IMG.stillaFarval,
    team: [],
    // Filens siffer-rad i /om — verbatim.
    stats: [
      ['100%', 'handbundet'],
      ['Samma dag', 'leverans'],
      ['Klassisk', 'stil'],
    ],
  },
  // Manifestets `caps`.
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  chrome: { Nav: EloriaNav, Footer: EloriaFooter, ownsUtility: true },
  pages: { om: EloriaOm, tjanster: EloriaTjanster, kontakt: EloriaKontakt },
  // goal-64: galleriet + Vänner av huset. Ingen team-vy — Elorias paket har ingen team-sida.
  moduleViews: {
    shop: EloriaShop,
    blogg: EloriaBlogg,
    galleri: EloriaGalleri,
    lojalitet: EloriaLojalitet,
  },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens inbyggda fallback VERBATIM
  // (EloriaLayout.tsx / eloria.modules.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'closingEyebrow', label: 'Bröllops-plattan: eyebrow', default: 'Livets stora stunder' },
    {
      name: 'pillar1Title',
      label: 'Bröllops-plattan: rubrik',
      default: 'Blommor för bröllop, fest och avsked',
    },
    {
      name: 'pillar1Body',
      label: 'Bröllops-plattan: text',
      rows: 3,
      default:
        'Varje arrangemang komponeras personligen, efter samtal med er. Vi tar emot ett begränsat antal uppdrag per helg — förfrågan kostar ingenting.',
    },
    { name: 'shopEyebrow', label: 'Katalog-bandet: eyebrow', default: 'Ur katalogen' },
    { name: 'shopTitle', label: 'Katalog-bandet: rubrik', default: 'Säsongens kompositioner' },
    { name: 'shopCta', label: 'Katalog-bandet: knapptext', default: 'Se hela katalogen' },
    { name: 'blogEyebrow', label: 'Journal-bandet: eyebrow', default: 'Journalen' },
    { name: 'blogTitle', label: 'Journal-bandet: rubrik', default: 'Ord om blommor' },
    { name: 'blogCta', label: 'Journal-bandet: knapptext', default: 'Läs hela journalen' },
    // goal-64: galleriet + brevet. default = vyns inbyggda fallback VERBATIM.
    { name: 'galleryEyebrow', label: 'Galleri: eyebrow', default: 'Galleri' },
    { name: 'galleryTitle', label: 'Galleri: rubrik', default: 'Ur vår hand' },
    { name: 'clubEyebrow', label: 'Vänner av huset: eyebrow', default: 'Lojalitet' },
    { name: 'clubTitle', label: 'Vänner av huset: rubrik', default: 'Vänner av huset' },
    {
      name: 'clubLede',
      label: 'Vänner av huset: brevets första stycke',
      rows: 4,
      default:
        'Somliga kommer tillbaka, år efter år. Er vill vi tacka särskilt. Som vän av huset får ni vårt säsongsbrev före alla andra, tio procent på alla binderikurser och en ros på er födelsedag — hämtas i butiken, med våra gratulationer.',
    },
    {
      name: 'clubNote',
      label: 'Vänner av huset: brevets andra stycke',
      rows: 2,
      default: 'Medlemskapet kostar ingenting. Det är vårt sätt att säga tack.',
    },
    { name: 'clubCta', label: 'Vänner av huset: knapptext', default: 'Bli vän av huset' },
  ],
}
