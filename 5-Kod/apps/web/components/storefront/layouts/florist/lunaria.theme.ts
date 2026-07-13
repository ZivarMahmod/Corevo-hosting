import type { FloristTheme } from './types'
import { LunariaNav, LunariaFooter } from './lunaria.chrome'
import { LunariaOm, LunariaTjanster, LunariaKontakt } from './lunaria.pages'
import { LunariaShop, LunariaBlogg, LunariaGalleri, LunariaLojalitet } from './lunaria.modules'

// Foto-id:n LYFTA ur .dc.html (rawProducts/blog/courses/galleryItems) — inte utbytta,
// inte "liknande". HANDOFF.md §2 regel 4: byt aldrig ett Unsplash-ID mot en slumpbild.
const u = (id: string, w = 1400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  astoria: u('1454262041357-5d96f50a2f27'), // hero + om-fotot i filen (vit orkidé)
  boulevard: u('1563241527-3004b7be0ffd'),
  champagne: u('1747226757800-6d8f87cfc0fe'),
  manhattan: u('1598453055371-0f5e37113bea'),
  solitar: u('1522748906645-95d8adfd52c7'),
  salongensVal: u('1602934585418-f588bea4215c'),
} as const

/**
 * LUNARIA — ART DÉCO (goal-64, Claude Design-paketet).
 *
 * EXAKT KOPIA av "Lunaria - Art Déco.dc.html". Palett, typsnitt, radie, navHeight och caps
 * är LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett.
 *
 * VIKTIGT: mallen är nu MÖRK (bläckblått #10233A + champagneguld #C6A664). Den GAMLA
 * lunaria var ljus (nattblå på linne) och är helt ersatt — palett, chrome, sidor och
 * modul-vyer är nya filer, ingen rad är återanvänd.
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan flaggan hade BRANSCH_COPY lagt
 * florist-branschens generiska hero-text ovanpå "Buketter i guldsnitt", och hela paketet
 * varit osynligt för varje florist-tenant. Ägarens egen text vinner fortfarande.
 */
export const lunaria: FloristTheme = {
  key: 'lunaria',
  name: 'Lunaria',
  desc: 'Art déco — bläckblått, champagneguld, symmetri.',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#C6A664',
    primaryD: '#B08F4C',
    bg: '#10233A',
    surface: '#17304C',
    fg: '#ECE6D6',
    fg2: '#B8BFCB',
    line: '#334455',
    accentSoft: '#7C8AA0',
  },
  // Manifestets `fonts`: Poiret One i displayen (deco-linjen), Jost i brödtexten.
  fonts: {
    display: 'var(--font-poiret), Georgia, serif',
    body: 'var(--font-jost), system-ui, sans-serif',
  },
  radius: '0px',
  navHeight: { desktop: '68px', mobile: '56px' },
  content: {
    heroEyebrow: 'Florist sedan MCMXXVI',
    heroTitle: 'Buketter i\nguldsnitt.',
    heroLede:
      'Komponerade med den geometriska elegansens öga — symmetri, lugn och en gnista guld. Levererade med bud.',
    tagline: 'Komponerade med den geometriska elegansens öga.',
    utility: 'Handbundet i salongen · Bud inom staden',
    // Filens manifest-citat på hemmet (radbrytningen är designens egen).
    italic: '”Symmetrin lugnar ögat.\nGuldet väcker det.”',
    aboutTitle: 'Salongen vid boulevarden',
    aboutCopy:
      'Lunaria öppnade 1926 som stadens första blomstersalong i decostil. Sedan dess har vi hållit fast vid samma idé: att en bukett ska komponeras som ett smycke — med proportion, balans och en gnista guld.',
    // Om-sidans ANDRA stycke (filen har två) — closingLede är den befintliga nyckeln.
    closingLede:
      'Idag binds allt fortfarande för hand i salongen, av florister som lärt sig hantverket i generationer.',
    // /tjanster = filens boka-ruta: etiketten "Ärende" över raderna.
    servicesEyebrow: 'Ärende',
    servicesTitle: 'Boka salongen',
    servicesIntro:
      'Konsultation för bröllop, större arrangemang eller ett samtal om det ni drömmer om.',
    contactTitle: 'Kontakt',
    teamEyebrow: 'Om salongen',
    teamTitle: 'Salongen vid boulevarden',
    heroImages: [IMG.astoria, IMG.boulevard, IMG.champagne],
    galleryImages: [
      IMG.astoria,
      IMG.boulevard,
      IMG.champagne,
      IMG.manhattan,
      IMG.solitar,
      IMG.salongensVal,
    ],
    aboutImage: IMG.astoria,
    closingImage: IMG.salongensVal,
    team: [],
    // Filens sifferband på om-sidan, verbatim.
    stats: [
      ['1926', 'grundades salongen'],
      ['100%', 'handbundet'],
      ['IV', 'generationer florister'],
    ],
  },
  // Manifestets `caps`.
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  chrome: { Nav: LunariaNav, Footer: LunariaFooter },
  pages: { om: LunariaOm, tjanster: LunariaTjanster, kontakt: LunariaKontakt },
  // goal-64: galleriet + Cirkeln. Ingen team-vy — Lunarias paket har ingen team-sida.
  moduleViews: {
    shop: LunariaShop,
    blogg: LunariaBlogg,
    galleri: LunariaGalleri,
    lojalitet: LunariaLojalitet,
  },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens inbyggda fallback VERBATIM
  // (LunariaLayout.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'pillar1Title', label: 'Salong I: rubrik', default: 'Bröllop' },
    { name: 'pillar1Body', label: 'Salong I: text', rows: 2, default: 'Brudbukett och dekor komponerad i decostil.' },
    { name: 'pillar2Title', label: 'Salong II: rubrik', default: 'Salongskvällar' },
    { name: 'pillar2Body', label: 'Salong II: text', rows: 2, default: 'Lär dig binda med balans och proportion.' },
    { name: 'pillar3Title', label: 'Salong III: rubrik', default: 'Cirkeln' },
    { name: 'pillar3Body', label: 'Salong III: text', rows: 2, default: 'Vår inre krets — förtur och privata kvällar.' },
    { name: 'galleryEyebrow', label: 'Urvalet: guld-delarens text', default: '◆ Salongens urval ◆' },
    { name: 'shopEyebrow', label: 'Salongen: eyebrow', default: 'Kollektion VII' },
    { name: 'shopTitle', label: 'Salongen: rubrik', default: 'Salongen' },
    { name: 'shopCta', label: 'Salongen: länktext', default: 'Hela samlingen →' },
    { name: 'blogTitle', label: 'Krönikan: rubrik', default: 'Krönikan' },
    { name: 'blogCta', label: 'Krönikan: länktext', default: 'Hela krönikan →' },
    // goal-64: galleriet + Cirkeln. default = vyns inbyggda fallback VERBATIM.
    { name: 'galleryTitle', label: 'Galleriet: rubrik', default: 'Galleriet' },
    { name: 'clubTitle', label: 'Cirkeln: rubrik', default: 'Cirkeln' },
    {
      name: 'clubLede',
      label: 'Cirkeln: text',
      rows: 2,
      default:
        'Lunarias inre krets. Kostnadsfritt medlemskap med förtur, förmåner och salongens privata kvällar.',
    },
    { name: 'clubCta', label: 'Cirkeln: knapptext', default: 'Ansök om medlemskap' },
  ],
}
