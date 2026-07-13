import type { FloristTheme } from './types'
import { OnyxNav, OnyxFooter } from './onyx.chrome'
import { OnyxOm, OnyxTjanster, OnyxKontakt } from './onyx.pages'
import { OnyxShop, OnyxBlogg, OnyxGalleri, OnyxLojalitet } from './onyx.modules'

// Foto-id:n LYFTA ur "Onyx - Mörk Studio.dc.html" (rawProducts/galleryItems/hero/om) —
// inte utbytta, inte "liknande". HANDOFF.md §2 regel 4: byt aldrig ett Unsplash-ID.
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  magnoliaNoir: u('1518343161123-c7e9ab4dc4da'), // FIG. 01 — hero i filen
  brandRosa: u('1557982780-d68d843c32ab'), // FIG. 02 — om-fotot i filen
  glod: u('1442458017215-285b83f65851'), // FIG. 03 — closing-fotot i filen
  vinmork: u('1612351641432-20a0f196086c'), // FIG. 04
  askros: u('1520179737749-b7752f6f56fb'), // FIG. 05
  calla: u('1469259943454-aa100abba749'), // FIG. 06
} as const

/**
 * ONYX — MÖRK STUDIO (goal-64, Claude Design-paketet).
 *
 * EXAKT KOPIA av "Onyx - Mörk Studio.dc.html". Palett, typsnitt, radie, navHeight och
 * caps är LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett. Copyn är filens
 * egen svenska, verbatim: "Blommor är inte alltid söta.", "Sista buketten binds 21:45."
 *
 * ONYX ÄR MÖRK (bg #121212, mässing #C9973F som ENDA accent). Mallens CSS sätter svart
 * botten på varje rot-sektion, så ingen text kan ärva en ljus yta.
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan flaggan hade BRANSCH_COPY lagt
 * florist-branschens generiska hero-text ovanpå nattfloristens, och hela paketet varit
 * osynligt för varje florist-tenant. Ägarens egen settings.copy vinner fortfarande.
 */
export const onyx: FloristTheme = {
  key: 'onyx',
  name: 'Onyx',
  desc: 'Nattflorist i svart och mässing.',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#C9973F',
    primaryD: '#B08434',
    bg: '#121212',
    surface: '#1C1C1C',
    fg: '#F2EFEA',
    fg2: '#9C968C',
    line: '#2E2E2E',
    accentSoft: '#6B655B',
  },
  // Manifestets `fonts`: Space Grotesk i rubrikerna, IBM Plex Mono i mikroetiketterna.
  fonts: {
    display: 'var(--font-spacegrotesk), system-ui, sans-serif',
    body: 'var(--font-plexmono), ui-monospace, monospace',
  },
  radius: '0px',
  // Manifestets navHeight — bor HÄR och aldrig i CSS (.shellMain är en global klass; en
  // ren :global()-regel i en CSS Module är inte "pure" → webpack-fel i prod-bygget).
  navHeight: { desktop: '68px', mobile: '56px' },
  content: {
    heroEyebrow: 'EST. 2019 — SÖDERMALM',
    heroTitle: 'Blommor är inte alltid söta.',
    heroLede:
      'Mörka sorter, skulpturala stjälkar och arrangemang med attityd. Bundna sent, levererade samma kväll — när blommor behövs som mest.',
    tagline: 'BLOMMOR EFTER MÖRKRETS INBROTT',
    utility: 'ÖPPET TIS–LÖR 12–22 · KATARINA BANGATA 9',
    // Filens manifest-band på hemmet.
    italic: 'Vi jobbar när staden vaknar på riktigt. Sista buketten binds 21:45.',
    aboutCopy:
      'Onyx startade som ett nattöppet blomsterstånd utanför en klubb på Södermalm. Idén var enkel: blommor behövs mest efter klockan sju — när middagen glömts, bråket ska sonas eller kvällen ska bli speciell.',
    aboutTitle: 'Floristen som aldrig sover.',
    servicesEyebrow: 'BOKNING',
    servicesTitle: 'Boka studion',
    teamEyebrow: 'OM ONYX',
    teamTitle: 'Floristen som aldrig sover.',
    heroImages: [IMG.magnoliaNoir, IMG.brandRosa, IMG.glod],
    galleryImages: [IMG.magnoliaNoir, IMG.brandRosa, IMG.glod, IMG.vinmork, IMG.askros, IMG.calla],
    aboutImage: IMG.brandRosa,
    closingImage: IMG.glod,
    team: [],
    // Filens tre siffror på /om — verbatim.
    stats: [
      ['21:45', 'sista bindningen, varje kväll'],
      ['7 dgr', 'hållbarhetsgaranti, annars ny kasse'],
      ['0 st', 'babyrosa ursäkter sedan 2019'],
    ],
  },
  // Manifestets `caps`, oförändrade: filen har varken sifferband eller galleri på hemmet.
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  // goal-59 TEMA-PAKET: Onyx äger sitt sidhuvud (railens form), sin sidfot och sina tre
  // undersidor. FUNKTIONEN är plattformens (NavShell + modul-gatade länkar/CTA).
  chrome: { Nav: OnyxNav, Footer: OnyxFooter },
  pages: { om: OnyxOm, tjanster: OnyxTjanster, kontakt: OnyxKontakt },
  // Vektor-regeln: modulen äger funktionen (data, korg, kassa), mallen formen.
  // goal-64: arkivet + Kretsen. Onyx "Kretsen" tvingades förut rendera olänkad text —
  // nu är den en riktig sida. Ingen team-vy: paketet har ingen team-sida.
  moduleViews: {
    shop: OnyxShop,
    blogg: OnyxBlogg,
    galleri: OnyxGalleri,
    lojalitet: OnyxLojalitet,
  },
  ownsCopy: true,
  // goal-61 editor-paritet: hemmets redigerbara element. default = layoutens inbyggda
  // fallback-sträng VERBATIM (OnyxLayout/onyx.modules) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'findEyebrow', label: 'Hero: fotnot', default: 'KVÄLLSLEVERANS 18–23 · BESTÄLL FÖRE 20:00' },
    { name: 'galleryEyebrow', label: 'Hero: bildtext (FIG)', default: 'FIG. 01 — MAGNOLIA NOIR' },
    { name: 'shopEyebrow', label: 'Butiken: eyebrow', default: 'DROP 27 — VECKA 28' },
    { name: 'shopTitle', label: 'Veckans drop: rubrik', default: 'Veckans drop' },
    { name: 'shopCta', label: 'Veckans drop: länktext', default: 'SE ALLT →' },
    { name: 'pillar1Title', label: 'Väg 02: rubrik', default: 'Veckans drop' },
    { name: 'pillar1Body', label: 'Väg 02: text', rows: 2, default: 'Begränsade buketter, nya varje måndag.' },
    { name: 'pillar2Title', label: 'Väg 03: rubrik', default: 'Night classes' },
    { name: 'pillar2Body', label: 'Väg 03: text', rows: 2, default: 'Kvällskurser i studion — bind till hög musik.' },
    { name: 'pillar3Title', label: 'Väg 08: rubrik', default: 'Kretsen' },
    { name: 'pillar3Body', label: 'Väg 08: text', rows: 2, default: 'Inre cirkeln. Tidig access och stängda kvällar.' },
    { name: 'blogEyebrow', label: 'Journal: eyebrow', default: 'JOURNAL' },
    { name: 'blogTitle', label: 'Journal: rubrik', default: 'Journal' },
    { name: 'blogCta', label: 'Journal: länktext', default: 'ALLA INLÄGG →' },
    { name: 'closingTitle', label: 'Avslutningen: rubrik', default: 'Ikväll, före 23:00.' },
    {
      name: 'closingLede',
      label: 'Avslutningen: text',
      rows: 2,
      default: 'Beställ före 20:00 så cyklar budet ut buketten samma kväll.',
    },
    // goal-64: arkivet + Kretsen. default = vyns inbyggda fallback VERBATIM.
    { name: 'galleryEyebrow', label: 'Galleri: eyebrow', default: 'ARKIV' },
    { name: 'galleryTitle', label: 'Galleri: rubrik', default: 'Galleri' },
    { name: 'clubEyebrow', label: 'Kretsen: eyebrow', default: 'MEDLEMSKAP' },
    { name: 'clubTitle', label: 'Kretsen: rubrik', default: 'Kretsen' },
    {
      name: 'clubLede',
      label: 'Kretsen: text',
      rows: 2,
      hint: 'Tom = klubbens egen "perkText" ur modulinställningarna.',
      default:
        'Onyx inre cirkel. Gratis att gå med — men droppen släpps till Kretsen 24 timmar före alla andra.',
    },
    { name: 'clubCta', label: 'Kretsen: knapptext', default: 'GÅ MED' },
  ],
}
