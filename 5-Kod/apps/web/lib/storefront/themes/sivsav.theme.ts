import { unsplashPhoto, type StorefrontThemeDefinition } from './types'

// Foto-id:n kommer från mallens designpaket och ingår i acceptanskanon.
const IMG = {
  sav: unsplashPhoto('1454262041357-5d96f50a2f27', 1200), // "Säv" — filens hero-foto
  salvia: unsplashPhoto('1563241527-3004b7be0ffd', 1200), // "Salvia" — filens om-foto (hem + /om)
  ranunkel: unsplashPhoto('1747226757800-6d8f87cfc0fe', 1200), // "Ranunkel, ensam sort"
  lin: unsplashPhoto('1522748906645-95d8adfd52c7', 1200), // "Lin"
  hostmanad: unsplashPhoto('1598453055371-0f5e37113bea', 1200), // "Höstmånad"
  fang: unsplashPhoto('1602934585418-f588bea4215c', 1200), // "Floristens fång"
} as const

/**
 * SIV & SÄV — skandinaviskt ljust (designpaketet).
 *
 * EXAKT KOPIA av "Siv & Säv - Skandinaviskt.dc.html". Palett, typsnitt, radie och navHeight
 * är LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett. Copyn är filens egen,
 * verbatim: "Stilla blomster för vardagsrum och stora dagar."
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan den flaggan hade BRANSCH_COPY lagt
 * florist-branschens generiska hero-text ovanpå filens, och hela designen varit osynlig
 * för varje florist-tenant. Ägarens egen text (settings.copy) vinner fortfarande.
 */
export const sivsav: StorefrontThemeDefinition = {
  key: 'sivsav',
  name: 'Siv & Säv',
  desc: 'Skandinaviskt ljust · varmvitt, salvia och pill-knappar',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#5D6A4E',
    primaryD: '#4F5A41',
    bg: '#F4F1EA',
    surface: '#FFFFFF',
    fg: '#33352E',
    fg2: '#6B6D60',
    line: '#DAD7C8',
    accentSoft: '#E4E7DA',
  },
  // Manifestets `fonts`: Fraunces i displayen (mjuk soft-serif), Hanken Grotesk i brödtexten.
  fonts: {
    display: 'var(--font-fraunces), Georgia, serif',
    body: 'var(--font-hanken), system-ui, sans-serif',
  },
  // Manifestets `radius`: 24px = mallens mjuka hörn. Pill (999px) sätts i CSS där filen har den.
  radius: '24px',
  navHeight: { desktop: '68px', mobile: '56px' },
  content: {
    heroEyebrow: 'Blomsterateljé · Stockholm',
    heroTitle: 'Stilla blomster för vardagsrum och stora dagar.',
    heroLede:
      'Vi binder sparsmakat och naturligt — säsongens grenar, gräs och blad, samlade med lugn hand.',
    tagline: 'Blomsterateljé',
    utility: 'Bundet i säsong · bud samma dag inom Stockholm',
    // Filens om-band på hemmet + andra stycket på /om.
    italic:
      'Allt binds för hand, i säsong, i den takt som känns rätt. Kom förbi på en kopp te — vi är oftast här.',
    aboutCopy:
      'Siv & Säv är en liten ateljé på Kungsholmen. Vi tror på det sparsmakade — ett fång gräs, en gren i knopp, en enda ranunkel. Blomster som får andas.',
    aboutCopyHome:
      'Siv & Säv drivs av två florister med en förkärlek för det ovala, det gräsiga och det som får ta plats i tystnad. Vi binder få buketter om dagen, för hand, med säsongen som enda regel.',
    aboutTitle: 'Två händer, ett fönster mot norr',
    servicesEyebrow: 'Bokning',
    servicesTitle: 'Boka en tid',
    teamEyebrow: 'Om oss',
    teamTitle: 'Ateljén',
    // Hero använder salvia, inte säv; designpaketet gav Siv & Säv och Lunaria samma
    // hero-foto (1454262041357). Mallväljaren visar heroImages[0] som mallens
    // ansikte, och två mallar med samma ansikte ÄR samma mall i galleriet. sav ligger kvar i
    // galleriet och används fortfarande av layouten.
    heroImages: [IMG.salvia, IMG.sav, IMG.ranunkel],
    galleryImages: [IMG.sav, IMG.salvia, IMG.ranunkel, IMG.hostmanad, IMG.lin, IMG.fang],
    aboutImage: IMG.salvia,
    closingImage: IMG.fang,
    team: [],
    stats: [],
  },
  // Manifestets `caps`, oförändrade: filen har eyebrow i heron och ett om-band på hemmet,
  // men varken stat-rad eller galleri-band där.
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens inbyggda fallback VERBATIM
  // (SivSavLayout.tsx / sivsav.modules.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'pillar1Title', label: 'Löfte 1: rubrik', default: 'Bundet i säsong' },
    {
      name: 'pillar1Body',
      label: 'Löfte 1: text',
      rows: 2,
      default:
        'Vi arbetar med det som växer just nu — därför ser buketten olika ut vecka till vecka.',
    },
    { name: 'pillar2Title', label: 'Löfte 2: rubrik', default: 'Samma dag' },
    {
      name: 'pillar2Body',
      label: 'Löfte 2: text',
      rows: 2,
      default: 'Beställ före kl 13 så levererar vårt bud inom Stockholm samma eftermiddag.',
    },
    { name: 'pillar3Title', label: 'Löfte 3: rubrik', default: 'Håller en vecka' },
    {
      name: 'pillar3Body',
      label: 'Löfte 3: text',
      rows: 2,
      default: 'Skötselråd följer med varje bukett. Håller den inte sju dagar binder vi en ny.',
    },
    { name: 'homeGalleryEyebrow', label: 'Om-bandet: eyebrow', default: 'Ateljén' },
    { name: 'shopEyebrow', label: 'Buketterna: eyebrow', default: 'Just nu' },
    { name: 'shopTitle', label: 'Buketterna: rubrik', default: 'Veckans buketter' },
    { name: 'shopCta', label: 'Buketterna: länktext', default: 'Hela sortimentet →' },
    { name: 'blogEyebrow', label: 'Journalen: eyebrow', default: 'Journalen' },
    { name: 'blogTitle', label: 'Journalen: rubrik', default: 'Journalen' },
    { name: 'blogCta', label: 'Journalen: länktext', default: 'Alla inlägg →' },
    // Galleriet och Söndagsklubben använder designens ordagranna fallback.
    { name: 'galleryEyebrow', label: 'Galleri: eyebrow', default: 'Portfolio' },
    { name: 'galleryTitle', label: 'Galleri: rubrik', default: 'Galleri' },
    { name: 'clubEyebrow', label: 'Söndagsklubben: eyebrow', default: 'Medlemskap' },
    { name: 'clubTitle', label: 'Söndagsklubben: rubrik', default: 'Söndagsklubben' },
    {
      name: 'clubLede',
      label: 'Söndagsklubben: text',
      rows: 2,
      default:
        'Färska blommor hem varje eller varannan vecka. Pausa när du vill, avsluta när du vill.',
    },
    { name: 'clubCta', label: 'Söndagsklubben: knapptext', default: 'Starta prenumeration' },
  ],
}
