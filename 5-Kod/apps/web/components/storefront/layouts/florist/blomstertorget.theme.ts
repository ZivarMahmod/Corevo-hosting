import type { FloristTheme } from './types'
import { BlomstertorgetNav, BlomstertorgetFooter } from './blomstertorget.chrome'
import { BlomstertorgetOm, BlomstertorgetTjanster, BlomstertorgetKontakt } from './blomstertorget.pages'
import {
  BlomstertorgetShop,
  BlomstertorgetBlogg,
  BlomstertorgetGalleri,
  BlomstertorgetLojalitet,
} from './blomstertorget.modules'
import { BlomstertorgetPresentkort } from '../presentkort-views'

// Foto-id:n LYFTA ur .dc.html (rawProducts/galleryItems/om-fotot) — inte utbytta, inte
// "liknande". HANDOFF.md §2 regel 4: "Bildbanken är verifierad. Byt inte Unsplash-ID:n
// mot slumpbilder."
const u = (id: string, w = 1400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  pioner: u('1598453055371-0f5e37113bea'), // huvudnyhetens 16:9 — morgonens leverans, gång 3
  tulpaner: u('1490750967868-88aa4486c946'), // bildsidan — tulpanlasset
  hjartbukett: u('1526047932273-341f2a7631f9'), // bildsidan — lördagens hjärtbukett
  fruBerg: u('1561181286-d3fee7d55364'), // om-fotot i filen — insänt: fru Bergs vas
  sommarbunt: u('1602934585418-f588bea4215c'),
  bondbukett: u('1487530811176-3780de880c2d'),
  solrosor: u('1455659817273-f96807779a8a'),
  rosor: u('1596309322315-da9e713cbb22'),
} as const

/**
 * BLOMSTERTORGET — dagstidning & torghandel (goal-64, Claude Design-paketet).
 *
 * EXAKT KOPIA av "Blomstertorget - Tidning.dc.html". Palett, typsnitt, radie och navHeight
 * är LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett. Mallen är en tidning:
 * masthead med kickerrad och namnvinjett i 72px Archivo 900, huvudnyhet i tvåspaltig
 * sättning, prisnoteringar i högerspalten och en streckad stamkundskupong som ska klippas ut.
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan flaggan hade BRANSCH_COPY lagt
 * florist-branschens generiska hero-text ovanpå "Pionerna har landat", och hela tidnings-
 * greppet varit osynligt för varje florist-tenant. Ägarens egen text vinner fortfarande.
 */
export const blomstertorget: FloristTheme = {
  key: 'blomstertorget',
  name: 'Blomstertorget',
  desc: 'Dagstidning och torghandel — newsprint och blanketter.',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#C1272D',
    primaryD: '#9E1F24',
    bg: '#F5F1E8',
    surface: '#EDE7D8',
    fg: '#191714',
    fg2: '#6E6A61',
    line: '#A8A296',
    accentSoft: '#EDE7D8',
  },
  // Manifestets `fonts`: Archivo (rubriker/etiketter, alltid versal) + Newsreader (brödtext).
  fonts: {
    display: 'var(--font-archivo), Helvetica, Arial, sans-serif',
    body: 'var(--font-newsreader), Georgia, serif',
  },
  radius: '0px',
  navHeight: { desktop: '68px', mobile: '56px' },
  content: {
    heroEyebrow: 'Dagens huvudnyhet',
    heroTitle: 'Pionerna har landat — torget öppnar 07:00',
    heroLede:
      'Årets pionleverans är den största i torgets historia. Fyrahundra buntar går ut i stånden i gryningen och erfarenheten säger att de är slut före lunch. Torgmästaren råder: kom tidigt, och pruta inte på pioner — det har aldrig fungerat och kommer aldrig att fungera. Den som inte hinner kan beställa här i tidningen; utkörning sker med cykelbud inom tullarna före klockan sex på kvällen.',
    tagline: '”Färska priser varje dag — sedan sextiotvå”',
    utility: 'Grundad 1962 · Hötorget',
    italic: 'Priserna sätts 06:45 varje morgon efter nattens inköp i Årsta.',
    aboutTitle: 'Om torget',
    aboutCopy:
      'Farfar Gösta ställde upp ståndet 1962 med en skottkärra tulpaner och en griffeltavla. Griffeltavlan finns kvar — priserna skrivs fortfarande för hand varje morgon, numera även här i tidningen.',
    servicesEyebrow: 'Kurser, visningar och evenemang vid torget. Platser bokas här och betalas i kassan.',
    servicesTitle: 'Kungörelser',
    teamEyebrow: 'Ståndet',
    teamTitle: 'Tre generationer, ett stånd',
    heroImages: [IMG.pioner, IMG.tulpaner, IMG.hjartbukett],
    galleryImages: [
      IMG.pioner,
      IMG.tulpaner,
      IMG.hjartbukett,
      IMG.fruBerg,
      IMG.sommarbunt,
      IMG.bondbukett,
      IMG.solrosor,
      IMG.rosor,
    ],
    aboutImage: IMG.fruBerg,
    closingImage: IMG.bondbukett,
    team: [],
    // Filens sifferruta på /om — [värde, etikett].
    stats: [
      ['64', 'år vid samma torg'],
      ['06:45', 'priserna sätts, varje dag'],
      ['0 kr', 'slängt — resten skänks'],
    ],
  },
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  chrome: { Nav: BlomstertorgetNav, Footer: BlomstertorgetFooter, ownsUtility: true },
  pages: { om: BlomstertorgetOm, tjanster: BlomstertorgetTjanster, kontakt: BlomstertorgetKontakt },
  // goal-64: bildsidan + stamkund. Ingen team-vy — torgets paket har ingen team-sida.
  moduleViews: {
    shop: BlomstertorgetShop,
    blogg: BlomstertorgetBlogg,
    galleri: BlomstertorgetGalleri,
    lojalitet: BlomstertorgetLojalitet,
    presentkort: BlomstertorgetPresentkort,
  },
  ownsCopy: true,
  // Redigerbara element. default = layoutens/vyernas inbyggda fallback VERBATIM
  // (BlomstertorgetLayout.tsx / .modules.tsx / .pages.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'findEyebrow', label: 'Huvudnyhet: ortsrad', default: 'Hötorget.' },
    { name: 'homeGalleryEyebrow', label: 'Huvudnyhet: fotobyline', default: 'Foto: Torgets egen — morgonens leverans, gång 3' },
    { name: 'pillar1Title', label: 'Kungörelser: rubrik', default: 'Kungörelser' },
    { name: 'pillar1Link', label: 'Kungörelser: länktext', default: 'alla kungörelser →' },
    { name: 'pillar2Title', label: 'Bildsidan: rubrik', default: 'Bildsidan' },
    { name: 'pillar2Body', label: 'Bildsidan: bildtext', rows: 2, default: 'Ur veckans arkiv — tulpanlasset & lördagens hjärtbukett' },
    { name: 'pillar2Link', label: 'Bildsidan: länktext', default: 'hela bildsidan →' },
    { name: 'pillar3Title', label: 'Kupongen: rubrik', default: '✂ Stamkundskupong' },
    { name: 'pillar3Body', label: 'Kupongen: text', rows: 2, default: 'Var 8:e bunt gratis för registrerade stamkunder.' },
    { name: 'pillar3Link', label: 'Kupongen: länktext', default: 'Registrera dig →' },
    { name: 'whyBody', label: 'Om torget: stycke 2', rows: 3, default: 'Vi köper på Årsta partihallar mellan fyra och sex, sätter priserna kvart i sju och står vid disken tills det tar slut eller klockan slår sex. Det som inte säljs skänks till äldreboendet på Norrtullsgatan — blommor ska stå i vas, inte i kyl.' },
    { name: 'whySub', label: 'Om torget: stycke 3', rows: 2, default: 'Tredje generationen driver nu både stånd och tidning. Fjärde generationen sorterar gummiband.' },
    { name: 'shopEyebrow', label: 'Torgpriser: prisnoteringarnas rubrik', default: 'Dagens priser' },
    { name: 'shopTitle', label: 'Torgpriser: rubrik', default: 'Torgpriser' },
    { name: 'shopCta', label: 'Torgpriser: länktext', default: 'Till torgpriserna →' },
    { name: 'blogEyebrow', label: 'Notiser: etikett', default: 'Notis' },
    { name: 'blogTitle', label: 'Notiser: rubrik', default: 'Notiser' },
    { name: 'blogCta', label: 'Notiser: länktext', default: 'läs mer →' },
    { name: 'contactTitle', label: 'Kontakt: rubrik', default: 'Till redaktionen' },
    { name: 'contactEyebrow', label: 'Kontakt: ingress', default: 'Frågor, beröm eller klagomål — allt läses, det mesta besvaras.' },
    // goal-64: bildsidan + stamkund. default = vyns inbyggda fallback VERBATIM.
    { name: 'galleryTitle', label: 'Bildsidan: rubrik', default: 'Bildsidan' },
    {
      name: 'galleryLede',
      label: 'Bildsidan: ingress',
      rows: 2,
      default: 'Veckans bilder från torget — insända av kunder och tagna av ståndets egna.',
    },
    { name: 'clubTitle', label: 'Stamkund: rubrik', default: 'Stamkund' },
    {
      name: 'clubLede',
      label: 'Stamkund: ingress',
      rows: 2,
      default: 'Torgets trognaste förtjänar torgets bästa. Registreringen är gratis och gäller för alltid.',
    },
    { name: 'clubEyebrow', label: 'Stamkund: kupongrubrik', default: '✂ Klipp ut och spara — stamkundens förmåner' },
    { name: 'clubCta', label: 'Stamkund: knapptext', default: 'Registrera mig' },
  ],
}
