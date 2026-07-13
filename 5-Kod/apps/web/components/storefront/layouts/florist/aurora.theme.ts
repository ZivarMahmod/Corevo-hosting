import type { FloristTheme } from './types'
import { AuroraNav, AuroraFooter } from './aurora.chrome'
import { AuroraOm, AuroraTjanster, AuroraKontakt } from './aurora.pages'
import { AuroraShop, AuroraBlogg, AuroraGalleri, AuroraLojalitet } from './aurora.modules'

// Foto-id:n LYFTA ur .dc.html — inte utbytta, inte "liknande".
// HANDOFF.md §2 regel 4: "Bildbanken är verifierad. Byt inte Unsplash-ID:n mot slumpbilder."
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  hero: u('1709983967470-f6c72b61cc62'), // heroens valv — "ur studion, bunden i morse"
  buketter: u('1747226757815-d827b3aa4c5a', 900), // paths[0] — Buketter
  brollop: u('1522748906645-95d8adfd52c7', 900), // paths[1] — Bröllop
  kurser: u('1487530811176-3780de880c2d', 900), // paths[2] — Kurser & event
  studion: u('1746929015083-b313a9cb7dff'), // showOm + hemmets "Studion"-valv
  angsbrev: u('1602934585418-f588bea4215c', 900), // rawProducts p3
  solvarm: u('1628456676381-cf822e3c3f9f', 900), // rawProducts p4
  closing: u('1711638753941-3a7128aa759f'), // avslutningens helbreddsfoto
  florister: u('1494790108377-be9c29b29330', 700), // team[0]
  buketterna: u('1500648767791-00dcc994a43e', 700), // team[1]
  radgivning: u('1438761681033-6461ffad8d80', 700), // team[2]
} as const

/**
 * AURORA — ROMANTISK STUDIO (goal-64, Claude Design-paketet).
 *
 * EXAKT KOPIA av "Aurora - Romantisk Studio.dc.html". Palett, typsnitt, radie och navHeight
 * är LYFTA ur filens `#corevo-manifest`-block — inget är re-härlett. Copyn är filens egen,
 * verbatim: blush + terracotta, valvbågar och en kursiv Lora som bär varje röst i sajten.
 *
 * ownsCopy: true — bransch-lagret hoppas över. Utan flaggan hade BRANSCH_COPY lagt florist-
 * branschens generiska hero-text ovanpå "Blommor med känsla, bundna för hand", och hela
 * paketet varit osynligt för varje florist-tenant. Ägarens egen text vinner fortfarande.
 */
export const aurora: FloristTheme = {
  key: 'aurora',
  name: 'Aurora',
  desc: 'Blush & terracotta · romantisk studio',
  // Manifestets `palette`, alla 8 nycklar, oförändrade.
  palette: {
    primary: '#B85C48',
    primaryD: '#8A3E2E',
    bg: '#FAF1EC',
    surface: '#F3DED4',
    fg: '#3A2A24',
    fg2: '#7A6257',
    line: '#EAD8CD',
    accentSoft: '#F3DED4',
  },
  // Manifestets `fonts`: Lora i displayen (kursiven ÄR mallens röst), Nunito Sans i allt
  // som är en uppgift — etiketter, knappar, priser.
  fonts: {
    display: 'var(--font-lora), Georgia, serif',
    body: 'var(--font-nunito), system-ui, sans-serif',
  },
  radius: '24px',
  navHeight: { desktop: '68px', mobile: '56px' },
  content: {
    heroEyebrow: 'Blomsterstudio',
    heroTitle: 'Blommor med känsla,\nbundna för hand.',
    heroLede:
      'Säsongens vackraste snitt, komponerade i vår studio. Skicka en hälsning, fira en stund eller unna dig själv något som doftar sommar.',
    tagline: 'blomsterstudio',
    utility: 'Samma dag-leverans · Handbundet varje morgon · Handskrivna kort',
    // Filens citat-band på hemmet — och signaturmeningen på /om.
    italic: '”En bukett säger mer än de flesta ord — vi ser till att den säger rätt sak.”',
    aboutCopy:
      'Aurora är en blomsterstudio med känsla för säsongens bästa snitt. Vi binder allt för hand, väljer blommorna på morgonen och packar varje beställning som om den var till någon vi själva tycker om.',
    aboutTitle: 'Ett litet rum fullt av blommor',
    servicesEyebrow: 'Kurser & event',
    servicesTitle: 'Bind din egen bukett',
    servicesIntro:
      'Små grupper, mycket blommor och fika i studion. Alla nivåer är välkomna.',
    teamEyebrow: 'Studion',
    teamTitle: 'Händerna bakom varje bukett',
    heroImages: [IMG.hero, IMG.studion, IMG.solvarm],
    // paths (3 första) + butikens övriga snitt — griden i /tjanster plockar ur samma bank.
    galleryImages: [
      IMG.buketter,
      IMG.brollop,
      IMG.kurser,
      IMG.solvarm,
      IMG.angsbrev,
      IMG.studion,
    ],
    aboutImage: IMG.studion,
    closingImage: IMG.closing,
    team: [
      { name: 'Floristerna', role: 'Binder allt för hand, varje dag', img: IMG.florister },
      { name: 'Buketterna', role: 'Säsongens bästa snitt', img: IMG.buketterna },
      { name: 'Rådgivningen', role: 'Hjälper dig välja rätt', img: IMG.radgivning },
    ],
    stats: [],
  },
  caps: { heroEyebrow: true, homeStats: false, homeGallery: false, homeAbout: true },
  chrome: { Nav: AuroraNav, Footer: AuroraFooter },
  pages: { om: AuroraOm, tjanster: AuroraTjanster, kontakt: AuroraKontakt },
  // goal-64: galleriet + Blomsterklubben. Ingen team-vy — Auroras paket har ingen team-sida.
  moduleViews: {
    shop: AuroraShop,
    blogg: AuroraBlogg,
    galleri: AuroraGalleri,
    lojalitet: AuroraLojalitet,
  },
  ownsCopy: true,
  // Redigerbara element på hemmet. default = layoutens inbyggda fallback VERBATIM
  // (AuroraLayout.tsx) — fältet ska förifyllas ärligt.
  extraHome: [
    { name: 'shopEyebrow', label: 'Favoriterna: eyebrow', default: 'Veckans favoriter' },
    { name: 'shopTitle', label: 'Favoriterna: rubrik', default: 'Mest älskade just nu' },
    { name: 'shopCta', label: 'Favoriterna: knapptext', default: 'Hela sortimentet' },
    { name: 'giftEyebrow', label: 'Presentkort-bandet: eyebrow', default: 'Presentkort' },
    {
      name: 'giftLede',
      label: 'Presentkort-bandet: text',
      rows: 2,
      default: 'Valfritt belopp, giltigt ett år — skickas vackert inslaget eller digitalt.',
    },
    { name: 'giftCta', label: 'Presentkort-bandet: länktext', default: 'till presentkorten →' },
    { name: 'blogEyebrow', label: 'Bloggbandet: eyebrow', default: 'Bloggen' },
    { name: 'blogTitle', label: 'Bloggbandet: rubrik', default: 'Från studion' },
    { name: 'blogCta', label: 'Bloggbandet: knapptext', default: 'Läs fler inlägg' },
    { name: 'contactEyebrow', label: 'Kontakt: eyebrow', default: 'Kontakt' },
    { name: 'contactTitle', label: 'Kontakt: rubrik', default: 'Säg hej!' },
    // goal-64: galleriet + klubben. default = vyns inbyggda fallback VERBATIM.
    { name: 'galleryEyebrow', label: 'Galleri: eyebrow', default: 'Galleri' },
    { name: 'galleryTitle', label: 'Galleri: rubrik', default: 'Ur studions dagbok' },
    // Designens rad är "följ oss gärna — @aurorastudio" (studions eget handtag). Tom
    // default: vi hittar aldrig på ett Instagram-konto åt kunden.
    { name: 'galleryLede', label: 'Galleri: fotnot', hint: 'Visas bara om du fyller i den.', default: '' },
    { name: 'clubEyebrow', label: 'Klubben: eyebrow', default: 'Blomsterklubben' },
    { name: 'clubTitle', label: 'Klubben: rubrik', default: 'Var nionde bukett bjuder vi på' },
    {
      name: 'clubLede',
      label: 'Klubben: text',
      rows: 2,
      hint: 'Tom = klubbens egen "perkText" ur modulinställningarna.',
      default: 'Gratis att gå med. Varje bukett ger en stämpel — den nionde väljer du fritt ur sortimentet.',
    },
    { name: 'clubCta', label: 'Klubben: knapptext', default: 'Gå med gratis' },
  ],
}
