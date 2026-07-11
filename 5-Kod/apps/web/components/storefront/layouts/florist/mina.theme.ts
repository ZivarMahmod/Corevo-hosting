import type { FloristTheme } from './types'
import { MinaNav, MinaFooter } from './mina.chrome'
import { MinaOm, MinaTjanster, MinaKontakt } from './mina.pages'

// Minas egen fotomanifest (Unsplash, curl -sI 200 OK + visuellt granskade
// 2026-07-11 — flera slumpvis testade Unsplash-id:n visade sig vara berg/
// arkitektur/lax-tallrik/neonskylt trots giltig 200, så varje id nedan är
// hämtat och synat innan det användes). Lokal u() — INGEN värde-import från
// theme-content.ts (bara `import type` är tillåtet från delade moduler; en
// värde-import hit skulle skapa en cirkulär import eftersom theme-content.ts
// importerar FLORIST_CONTENT från registry.ts som importerar denna fil).
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  banner: u('1526047932273-341f2a7631f9'), // händer håller en hjärtformad bukett mot klarrosa botten
  roseVase: u('1591886960571-74d43a9d4166'), // rosa/gräddvita rosor i glasvas
  lily: u('1502977249166-824b3a8a4d6d'), // rosa lilja i glasflaska mot vit botten
  roseSolo: u('1518895949257-7621c3c786d7'), // ensam rosa ros i glasvas, kvällsljus
  blossom: u('1462275646964-a0e3386b89fa'), // klarrosa körsbärsblom mot blå himmel
  florist: u('1487530811176-3780de880c2d'), // person håller upp en färdig bukett
  cactusMug: u('1509587584298-0f3b3a3a1797'), // liten rosa kaktusblomma i vit mugg
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1500648767791-00dcc994a43e', 700),
} as const

/**
 * MINA — klarrosa & vitt, minimal och ung florist-e-handel (florist-sviten,
 * goal-58). EGEN sektionsordning (ingen annan mall i sviten har den): (1) hero
 * utan bild — STOR typografi på en klarrosa färgplatta, texten är hjälten,
 * (2) en bred bild-banner i fullbredd direkt under, (3) shop-teasers i ett
 * tätt fyr-kolumners grid (minsta korten i sviten), (4) tjänster som täta,
 * onumrerade rader (versal namn, hårfin linje — inget serif-numrerat rad-
 * mönster som resten av sviten), (5) om i en smal centrerad spalt (ingen
 * sido-bild, till skillnad från alla andra mallars två-kolumners om-sektion),
 * (6) presentkort som en smal rad, (7) blogg i samma täta grid-språk som
 * butiken, (8) plats & öppettider, (9) closing i en klarrosa färgplatta som
 * speglar hero (bookend). Sans-only typografi (Jost display + Inter body) —
 * enda mallen i sviten utan serif-rubriker. Se MinaLayout.tsx för sektionerna
 * i sin helhet. Känsla: modern DTC-e-handel, typ-driven, tight.
 */
export const mina: FloristTheme = {
  key: 'mina',
  name: 'Mina',
  desc: 'Klarrosa & vitt · minimal DTC-e-handel',
  // PALETT — 8 hex, EN kulörfamilj (rosa/magenta 330–340°) + neutral ink.
  // SKÄRPE-PASS 2026-07-11 (design-skarpa-zentum.md): `primary` var #C2185B
  // (hsl 338, 78%, 43%) → vit text på färgplattan gav bara 5.87:1, under
  // rubrik-kravet ≥7:1, och heron/closing ÄR färgplattor med vit rubrik. Samma
  // kulör behållen (hue 338°, sat 78%), bara mörkare (L 43% → 36%) → 7.63:1.
  // Klarrosan lever kvar i accentSoft/surface (de STORA ljusa ytorna); accenten
  // sitter på små ytor: plattor, knappar, priser, statsiffror — aldrig eyebrows
  // (regel 8: en accent i varje sektion slutar vara en accent).
  // Uträknat (node, WCAG 2.x relativ luminans):
  //   fg      #18121A på bg #FFFFFF ......... 18.42:1  AAA (rubrik-ink, mål 11)
  //   fg      #18121A på accentSoft ......... 15.25:1  AAA (presentkortsraden)
  //   vit     #FFFFFF på primary ............  7.63:1  AAA (hero-/closing-rubrik)
  //   fg-2    #6B6270 på bg .................  5.82:1  AA  (brödtext — backar medvetet)
  //   vit 90% på primary (ingress) .........   6.42:1  AA  (var 3.43:1 → FAIL)
  //   vit     #FFFFFF på primary (knapptext)   7.63:1  AAA (krav ≥4.5)
  //   primary #A31449 på vit (inverterad CTA)  7.63:1  AAA
  //   primary #A31449 på bg (pris/statsiffra)  7.63:1  AAA
  palette: {
    primary: '#A31449',
    primaryD: '#8C0F40',
    bg: '#FFFFFF',
    surface: '#FFF6F9',
    fg: '#18121A',
    fg2: '#6B6270',
    line: '#F1E1E8',
    accentSoft: '#FDE3ED',
  },
  fonts: {
    // Jost som DISPLAY (inte body, som resten av sviten kör den) — en geometrisk
    // grotesk i medium/semibold vikt bär "stor typografi är hjälten"-heron utan
    // att bli en tung klump (design-skärpa: 500-600, aldrig 700 på stora rubriker).
    // Inter som body — neutral, tight, e-handelsgrotesk. Ingen serif alls i Mina;
    // det gör den till den enda helt sans-mallen i sviten.
    display: 'var(--font-jost), system-ui, sans-serif',
    body: 'var(--font-inter), system-ui, sans-serif',
  },
  // RADIE — binärt (skärpe-pass): 0 på ALL struktur (kort, bilder, karta,
  // sektioner) via --sf-radius. Full pill lever kvar där den är ett MEDVETET
  // undantag: knapparna (.btn-accent, --radius-pill) och hero-eyebrowns tagg.
  // 7px på allt var "moroten" — inga raka linjer kvar att linjera mot.
  radius: '0px',
  content: {
    heroEyebrow: '— Ny bukett, varje vecka',
    heroTitle: 'Blommor\nutan krångel.',
    heroLede:
      'Handplockade buketter du beställer på under en minut — hämta i butiken eller få dem hemlevererade.',
    tagline: 'Blommor, enkelt gjort.',
    utility: 'Beställ online · Hämta eller få hemlevererat',
    italic: 'Vackert är aldrig krångligt.',
    aboutCopy:
      'Vi är en blomsterbutik för dig som vill ha vackert utan att krångla till det. Säsongens bästa snitt, valda med gott öga och packade med omsorg — redo att hämtas eller skickas vidare.',
    servicesEyebrow: '— Tjänster',
    servicesTitle: 'Det vi erbjuder',
    aboutTitle: 'Kort sagt, om oss',
    teamEyebrow: '— Teamet',
    teamTitle: 'Händerna bakom varje bukett',
    heroImages: [IMG.banner, IMG.roseVase, IMG.lily],
    galleryImages: [IMG.roseVase, IMG.lily, IMG.roseSolo, IMG.blossom, IMG.florist, IMG.cactusMug],
    aboutImage: IMG.florist,
    closingImage: IMG.blossom,
    team: [
      { name: 'Vårt team', role: 'Floristerna i butiken', img: IMG.p1 },
      { name: 'Beställningar', role: 'Bukett & förpackning', img: IMG.p2 },
    ],
    stats: [
      ['Dagsfärskt', 'varje leverans'],
      ['Handplockat', 'av floristen'],
      ['Enkelt', 'beställt på minuter'],
    ],
    // goal-57 körning 13-fälten: Minas egna sektionsrubriker (fallbacks i
    // MinaLayout.tsx om owner inte satt något via settings.copy).
    shopEyebrow: '— Handla nu',
    shopTitle: 'Beställ något fint',
    shopCta: 'Visa hela sortimentet',
    blogEyebrow: '— Inspiration',
    blogTitle: 'Tips, säsong & idéer',
    blogCta: 'Läs mer',
    giftEyebrow: '— Presentkort',
    giftLede: 'Ge bort blommor, när som helst.',
    giftCta: 'Köp presentkort',
    findEyebrow: '— Hitta hit',
    galleryEyebrow: '— Galleri',
    closingTitle: 'Redo att beställa?',
    closingLede: 'Välj din bukett, hämta i butiken eller få den levererad hem.',
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: false, homeAbout: true },
  // goal-59 TEMA-PAKET: Mina äger HELA sajten — sidhuvud (platt butiksrad, wordmark
  // vänster, meny + korg + rosa pill höger, ingen utility-rad), sidfot (EN rosa rad)
  // och undersidorna (smal /om, chip-grid /tjanster, formulärskort /kontakt).
  // Funktionen (NavShell, korg, konto, modul-gatade länkar, Bookable) är plattformens.
  chrome: { Nav: MinaNav, Footer: MinaFooter },
  pages: { om: MinaOm, tjanster: MinaTjanster, kontakt: MinaKontakt },
}
