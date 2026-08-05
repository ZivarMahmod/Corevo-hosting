import { unsplashPhoto, type StorefrontThemeDefinition } from './types'

// Foto-id:n kommer från mallens designpaket och ingår i acceptanskanon.
const IMG = {
  astoria: unsplashPhoto('1454262041357-5d96f50a2f27', 1400), // hero + om-fotot i filen (vit orkidé)
  boulevard: unsplashPhoto('1563241527-3004b7be0ffd', 1400),
  champagne: unsplashPhoto('1747226757800-6d8f87cfc0fe', 1400),
  manhattan: unsplashPhoto('1598453055371-0f5e37113bea', 1400),
  solitar: unsplashPhoto('1522748906645-95d8adfd52c7', 1400),
  floristensVal: unsplashPhoto('1602934585418-f588bea4215c', 1400),
} as const

/**
 * LUNARIA — art déco (designpaketet).
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
export const lunaria: StorefrontThemeDefinition = {
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
    accentSoft: '#B8BFCB',
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
    utility: 'Handbundet i ateljén · Bud inom staden',
    // Filens manifest-citat på hemmet (radbrytningen är designens egen).
    italic: '”Symmetrin lugnar ögat.\nGuldet väcker det.”',
    aboutTitle: 'Blomsterboden vid boulevarden',
    aboutCopy:
      'Lunaria öppnade 1926 som stadens första blomstersalong i decostil. Sedan dess har vi hållit fast vid samma idé: att en bukett ska komponeras som ett smycke — med proportion, balans och en gnista guld.',
    // Om-sidans ANDRA stycke (filen har två) — closingLede är den befintliga nyckeln.
    closingLede:
      'Idag binds allt fortfarande för hand i ateljén, av florister som lärt sig hantverket i generationer.',
    // /tjanster = filens boka-ruta: etiketten "Ärende" över raderna.
    servicesEyebrow: 'Ärende',
    servicesTitle: 'Besök butiken',
    servicesIntro:
      'Konsultation för bröllop, större arrangemang eller ett samtal om det ni drömmer om.',
    contactTitle: 'Kontakt',
    teamEyebrow: 'Om butiken',
    teamTitle: 'Blomsterboden vid boulevarden',
    heroImages: [IMG.astoria, IMG.boulevard, IMG.champagne],
    galleryImages: [
      IMG.astoria,
      IMG.boulevard,
      IMG.champagne,
      IMG.manhattan,
      IMG.solitar,
      IMG.floristensVal,
    ],
    aboutImage: IMG.astoria,
    closingImage: IMG.floristensVal,
    team: [],
    // Filens sifferband på om-sidan, verbatim.
    stats: [
      ['1926', 'slog butiken rot'],
      ['100%', 'handbundet'],
      ['IV', 'generationer florister'],
    ],
  },
  // Manifestets `caps`.
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens inbyggda fallback VERBATIM
  // (LunariaLayout.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'pillar1Title', label: 'Pelare I: rubrik', default: 'Bröllop' },
    {
      name: 'pillar1Body',
      label: 'Pelare I: text',
      rows: 2,
      default: 'Brudbukett och dekor komponerad i decostil.',
    },
    { name: 'pillar2Title', label: 'Pelare II: rubrik', default: 'Bindkvällar' },
    {
      name: 'pillar2Body',
      label: 'Pelare II: text',
      rows: 2,
      default: 'Lär dig binda med balans och proportion.',
    },
    { name: 'pillar3Title', label: 'Pelare III: rubrik', default: 'Cirkeln' },
    {
      name: 'pillar3Body',
      label: 'Pelare III: text',
      rows: 2,
      default: 'Vår inre krets — förtur och privata kvällar.',
    },
    {
      name: 'homeGalleryEyebrow',
      label: 'Urvalet: guld-delarens text',
      default: '◆ Floristens urval ◆',
    },
    { name: 'shopEyebrow', label: 'Butiken: eyebrow', default: 'Kollektion VII' },
    { name: 'shopTitle', label: 'Butiken: rubrik', default: 'Blomsterboden' },
    { name: 'shopCta', label: 'Butiken: länktext', default: 'Hela samlingen →' },
    { name: 'blogTitle', label: 'Krönikan: rubrik', default: 'Krönikan' },
    { name: 'blogCta', label: 'Krönikan: länktext', default: 'Hela krönikan →' },
    // Galleriet och Cirkeln använder designens ordagranna fallback.
    { name: 'galleryTitle', label: 'Galleriet: rubrik', default: 'Galleriet' },
    { name: 'clubTitle', label: 'Cirkeln: rubrik', default: 'Cirkeln' },
    {
      name: 'clubLede',
      label: 'Cirkeln: text',
      rows: 2,
      default:
        'Lunarias inre krets. Kostnadsfritt medlemskap med förtur, förmåner och butikens privata kvällar.',
    },
    { name: 'clubCta', label: 'Cirkeln: knapptext', default: 'Ansök om medlemskap' },
  ],
}
