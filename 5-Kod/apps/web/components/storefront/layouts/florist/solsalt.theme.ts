import type { FloristTheme } from './types'
import { SolSaltNav, SolSaltFooter } from './solsalt.chrome'
import { SolSaltOm, SolSaltTjanster, SolSaltKontakt } from './solsalt.pages'
import { SolSaltShop, SolSaltBlogg, SolSaltGalleri, SolSaltLojalitet } from './solsalt.modules'
import { SolSaltPresentkort } from '../presentkort-views'

// Foto-id:n LYFTA ur .dc.html (rawProducts/blog/galleryItems) — inte utbytta, inte "liknande".
// HANDOFF.md §2 regel 4: "Bildbanken är verifierad. Byt inte Unsplash-ID:n mot slumpbilder."
const u = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  sirocco: u('1602934585418-f588bea4215c'), // heroens foto i filen
  amalfi: u('1490750967868-88aa4486c946'), // filens om-foto (både hem-bandet och /om)
  oliv: u('1563241527-3004b7be0ffd'),
  solros: u('1470509037663-253afd7f0f51'),
  medelhav: u('1598453055371-0f5e37113bea'),
  bodensVal: u('1522748906645-95d8adfd52c7'),
} as const

/**
 * SOL & SALT — medelhavsbod (goal-64, Claude Design-paketet).
 *
 * EXAKT KOPIA av "Sol & Salt - Medelhav.dc.html". Palett, typsnitt, radie, navHeight och caps
 * är LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett.
 *
 * OBS paletten: `primaryD` = #C2512E (TERRAKOTTA), inte en mörkare kobolt. Det är avsiktligt
 * i manifestet och ÄR mallen: varje hover i filen går från kobolt till terrakotta, och varje
 * eyebrow är terrakotta. "Rätta" den aldrig till en nyansmörkare primary.
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan flaggan hade BRANSCH_COPY lagt florist-
 * branschens generiska hero-text ovanpå "Sommar i bukettform.", och designens egen röst
 * varit osynlig för varje florist-tenant. Ägarens settings.copy vinner fortfarande.
 */
export const solsalt: FloristTheme = {
  key: 'solsalt',
  name: 'Sol & Salt',
  desc: 'Medelhavsbod — kobolt, solgult och terrakotta.',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#1F4F9C',
    primaryD: '#C2512E',
    bg: '#FAF3E1',
    surface: '#FFFCF2',
    fg: '#1E2B49',
    fg2: '#55523F',
    line: '#EADDBB',
    accentSoft: '#CBDCF6',
  },
  // Manifestets `fonts`: DM Serif Display i displayen, Figtree i brödtexten.
  fonts: {
    display: 'var(--font-dmserif), Georgia, serif',
    body: 'var(--font-figtree), system-ui, sans-serif',
  },
  radius: '24px',
  navHeight: { desktop: '68px', mobile: '56px' },
  content: {
    // All copy är filens egen svenska, verbatim.
    heroEyebrow: 'Blomster & grönt',
    heroTitle: 'Sommar i\nbukettform.',
    heroLede:
      'Solmogna färger, medelhavsgrönt och krukväxter som trivs. Plockat med värme, hemkört med sol i.',
    tagline: 'Blomster & grönt',
    // Solremsan under heron (filens gula band). Mallens Nav äger utility-raden
    // (chrome.ownsUtility) så plattformens egen remsa inte dubbleras ovanpå den.
    utility:
      'Fri hemkörning över 400 kr · Färskt från grossisten varje morgon · Öppet alla dagar',
    italic: 'Boden är liten, sortimentet ärligt och kaffet alltid på. Kom förbi.',
    aboutCopy:
      'Sol & Salt föddes ur en längtan efter medelhavets färger på en grå gata. Vi handplockar det soldränkta — citrongult, koboltblått, terrakotta — och binder buketter som doftar semester.',
    aboutTitle: 'Sol i, salt ut, blommor på hörnet',
    servicesEyebrow: 'Bodens bord',
    servicesTitle: 'Boka oss',
    teamEyebrow: 'Om boden',
    teamTitle: 'En bit medelhav på hörnet',
    heroImages: [IMG.sirocco, IMG.amalfi, IMG.medelhav],
    galleryImages: [IMG.amalfi, IMG.sirocco, IMG.oliv, IMG.solros, IMG.medelhav, IMG.bodensVal],
    aboutImage: IMG.amalfi,
    closingImage: IMG.bodensVal,
    team: [],
    stats: [],
  },
  // Manifestets `caps`, oförändrade: mallen har ingen statistik-rad och inget galleri-band
  // på hemmet — och då ska Sida-editorn inte heller erbjuda fälten.
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  chrome: { Nav: SolSaltNav, Footer: SolSaltFooter, ownsUtility: true },
  pages: { om: SolSaltOm, tjanster: SolSaltTjanster, kontakt: SolSaltKontakt },
  // goal-64: galleriet + Solklubben. Ingen team-vy — paketet har ingen team-sida.
  moduleViews: {
    shop: SolSaltShop,
    blogg: SolSaltBlogg,
    galleri: SolSaltGalleri,
    lojalitet: SolSaltLojalitet,
    presentkort: SolSaltPresentkort,
  },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens/vyernas inbyggda fallback VERBATIM —
  // fältet ska förifyllas ärligt, aldrig med en påhittad platshållare.
  extraHome: [
    { name: 'aboutCopyHome', label: 'Boden (hem): text', rows: 3, default: 'Sol & Salt är en liten blomsterbod med förkärlek för det soldränkta — citrongult, koboltblått och allt grönt som tål en varm fönsterbräda. Vi plockar på morgonen och binder hela dagen.' },
    { name: 'pillar1Title', label: 'Platta 1: rubrik', default: 'Hemkörning' },
    { name: 'pillar1Body', label: 'Platta 1: text', rows: 2, default: 'Fri över 400 kr, samma dag.' },
    { name: 'pillar2Title', label: 'Platta 2: rubrik', default: 'Krukväxter' },
    { name: 'pillar2Body', label: 'Platta 2: text', rows: 2, default: 'Grönt som tål en solig bräda.' },
    { name: 'pillar3Title', label: 'Platta 3: rubrik', default: 'Presentkort' },
    { name: 'pillar3Body', label: 'Platta 3: text', rows: 2, default: 'Ge bort en bit medelhav.' },
    { name: 'shopEyebrow', label: 'Veckans favoriter: eyebrow', default: 'Ur boden' },
    { name: 'shopTitle', label: 'Veckans favoriter: rubrik', default: 'Veckans favoriter' },
    { name: 'shopCta', label: 'Veckans favoriter: länktext', default: 'Hela sortimentet →' },
    { name: 'blogTitle', label: 'Från boden: rubrik', default: 'Från boden' },
    { name: 'blogCta', label: 'Från boden: länktext', default: 'Läs allt från boden →' },
    // goal-64: galleriet + Solklubben. default = vyns inbyggda fallback VERBATIM.
    { name: 'galleryTitle', label: 'Galleri: rubrik', default: 'Galleri' },
    { name: 'clubTitle', label: 'Solklubben: rubrik', default: 'Solklubben' },
    {
      name: 'clubLede',
      label: 'Solklubben: text',
      rows: 2,
      hint: 'Tom = klubbens egen "perkText" ur modulinställningarna.',
      default: 'Gratis att gå med. Samla solar på ditt kort — var tionde bukett bjuder boden på.',
    },
    { name: 'clubCta', label: 'Solklubben: knapptext', default: 'Gå med gratis' },
  ],
}
