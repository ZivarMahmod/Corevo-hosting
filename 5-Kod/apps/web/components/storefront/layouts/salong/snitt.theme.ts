import type { SalongTheme } from './types'
import { SnittNav, SnittFooter } from './snitt.chrome'
import { SnittOm, SnittTjanster, SnittKontakt } from './snitt.pages'
import {
  SnittShop,
  SnittBlogg,
  SnittGalleri,
  SnittLojalitet,
  SnittTeam,
} from './snitt.modules'
import { SnittPresentkort } from '../presentkort-views'

// Foto-id:n LYFTA ur "Snitt - Svart Studio.dc.html" — inte utbytta, inte "liknande".
// HANDOFF.md §2 regel 4: "Bildbanken är verifierad. Byt inte Unsplash-ID:n mot slumpbilder."
const u = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  stolarna: u('1560066984-138dadb4c035'), // heroens breda 4:3 (+ om-fotot i filens showOm)
  spegeln: u('1488161628813-04466f872be2', 900), // heroens nedskjutna 3:4
  klippet: u('1529139574466-a303027c1d8b', 900), // heroens högra 3:4
  studion: u('1562322140-8baeececf3df'), // om-sektionens 4:5 på hemmet
  galleri1: u('1509631179647-0177331693ae', 900),
  galleri2: u('1492106087820-71f1a00d2b11', 900),
  galleri3: u('1531727991582-cfd25ce79613', 900),
  galleri4: u('1539109136881-3be0616acf4b', 900),
} as const

/**
 * SNITT — SVART STUDIO (goal-64, Claude Design-paketet).
 *
 * EXAKT KOPIA av "Snitt - Svart Studio.dc.html". Palett, typsnitt, radie (0) och navHeight
 * är LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett. Copyn är filens egen,
 * verbatim: poster-versaler, korta meningar, och tjänsternas SIGNATURNAMN ("Som vanligt,
 * fast bättre", "Solen gjorde det") som bor i kundens egna tjänster, aldrig som fejkade
 * prisrader i mallen.
 *
 * LIMEN (#D6F344) BÄR ALLTID SVART TEXT. Aldrig tvärtom — se snitt.module.css.
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan den flaggan hade BRANSCH_COPY lagt
 * salong-branschens generiska hero-text ovanpå "Hår med kant." och hela paketet varit
 * osynligt för varje salong-tenant. Ägarens egen text vinner fortfarande.
 */
export const snitt: SalongTheme = {
  key: 'snitt',
  name: 'Snitt',
  desc: 'Svart studio · poster-typografi och lime',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#D6F344',
    primaryD: '#C4E52F',
    bg: '#141412',
    surface: '#1D1D1A',
    fg: '#EFEDE6',
    fg2: '#A39F93',
    line: '#2C2C27',
    accentSoft: '#6E6B61',
  },
  // Manifestets `fonts`: Anton i displayen (poster-versaler), Work Sans i brödtexten.
  // Båda laddas via next/font i app/layout.tsx (--font-anton / --font-worksans).
  fonts: {
    display: 'var(--font-anton), Impact, system-ui, sans-serif',
    body: 'var(--font-worksans), system-ui, sans-serif',
  },
  radius: '0px',
  navHeight: { desktop: '62px', mobile: '56px' },
  content: {
    heroEyebrow: 'Frisörstudio · Hantverk',
    heroTitle: 'Hår med\nkant.',
    heroLede:
      'Klippning, färg och styling med fokus på hantverk och personlig service. Varje stol är en stund för sig själv.',
    tagline: 'Frisörstudio med hantverk',
    utility: 'Boka enkelt online · Drop-in putsning fredagar 15–18',
    italic: 'Tre stolar, bra kaffe och en spellista som tar sig. Välkommen att boka din tid.',
    aboutCopy:
      'Snitt är en frisörstudio med fokus på kvalitet, hantverk och personlig service. Varje behandling utförs med noggrannhet och anpassas efter dina önskemål, din hårtyp och din stil.',
    servicesEyebrow: 'Tjänster & priser',
    servicesTitle: 'Prislistan',
    aboutTitle: 'En frisörstudio med hantverk.',
    teamEyebrow: 'Stolarna',
    teamTitle: 'Vilka klipper?',
    heroImages: [IMG.stolarna, IMG.spegeln, IMG.klippet],
    galleryImages: [IMG.galleri1, IMG.galleri2, IMG.galleri3, IMG.spegeln, IMG.galleri4, IMG.stolarna],
    aboutImage: IMG.studion,
    closingImage: IMG.stolarna,
    // Team är OWNER-ONLY: tom lista → "Stolarna"-sektionen ritas inte alls.
    team: [],
    // Inga mallvärden får framstå som salongens fakta. Verifierade, ägarsparade
    // branding.stats kan fortfarande fylla blocket; utan dem ritas det inte.
    stats: [],
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: false, homeAbout: true },
  chrome: { Nav: SnittNav, Footer: SnittFooter, ownsUtility: true },
  pages: { om: SnittOm, tjanster: SnittTjanster, kontakt: SnittKontakt },
  // goal-64: Galleri, Insidan (lojalitet) och Stolarna (team). Tom personal-lista →
  // team-vyn renderar ingenting (OWNER-ONLY).
  moduleViews: {
    shop: SnittShop,
    blogg: SnittBlogg,
    galleri: SnittGalleri,
    lojalitet: SnittLojalitet,
    team: SnittTeam,
    presentkort: SnittPresentkort,
  },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens inbyggda fallback VERBATIM
  // (SnittLayout.tsx / snitt.pages.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'pillar1Title', label: 'Prislistan på hemmet: rubrik', default: 'Hantverket, presenterat.' },
    {
      name: 'pillar1Body',
      label: 'Prislistan på hemmet: text',
      rows: 3,
      default:
        'Varje behandling anpassas efter din stil, hårtyp och ansiktsform. Priserna gäller oavsett längd — vi tar betalt för tid, inte centimeter.',
    },
    { name: 'pillar2Title', label: 'Lime-bandet: rubrik', default: 'Hitta en tid som passar dig.' },
    { name: 'findEyebrow', label: 'Plats: eyebrow', default: 'Plats & öppettider' },
    { name: 'pillar3Title', label: 'Plats: rubrik', default: 'Hittar du hit?' },
    {
      name: 'servicesIntro',
      label: 'Prislistan (sidan): intro',
      rows: 3,
      default:
        'Konsultation ingår alltid. Behöver vi mer tid än bokat kostar det inget extra — det är vårt problem, inte ditt.',
    },
    { name: 'contactTitle', label: 'Kontakt: rubrik', default: 'Kontakt' },
    { name: 'shopEyebrow', label: 'Hyllan: eyebrow', default: 'Butik' },
    { name: 'shopTitle', label: 'Hyllan: rubrik', default: 'Hyllan' },
    { name: 'shopCta', label: 'Hyllan: länktext', default: 'Hela hyllan →' },
    { name: 'blogEyebrow', label: 'Journal: eyebrow', default: 'Ur stolen' },
    { name: 'blogTitle', label: 'Journal: rubrik', default: 'Journal' },
    { name: 'blogCta', label: 'Journal: länktext', default: 'Hela journalen →' },
    // goal-64: Galleri + Insidan. default = vyns inbyggda fallback VERBATIM.
    { name: 'galleryEyebrow', label: 'Galleri: eyebrow', default: 'Arbeten ur stolen' },
    { name: 'galleryTitle', label: 'Galleri: rubrik', default: 'Galleri' },
    { name: 'clubEyebrow', label: 'Insidan: eyebrow', default: 'Stamkund' },
    { name: 'clubTitle', label: 'Insidan: rubrik', default: 'Insidan' },
    {
      name: 'clubLede',
      label: 'Insidan: text',
      rows: 2,
      default: 'Gratis att gå med. Byggd för dig som kommer tillbaka var sjätte vecka ändå.',
    },
    // Designens stamkort trycker salongens adress. Den är kundens fakta — tom default.
    { name: 'clubNote', label: 'Insidan: kortets underrad', hint: 'T.ex. gata + stad. Visas bara om du fyller i den.', default: '' },
    { name: 'clubCta', label: 'Insidan: knapptext', default: 'Gå med gratis' },
  ],
}
