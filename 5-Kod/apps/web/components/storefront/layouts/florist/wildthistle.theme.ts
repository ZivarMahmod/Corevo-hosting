import type { FloristTheme } from './types'

// Wild Thistle-temats egen fotomanifest (Unsplash). Varje id nedan curl -sI → 200
// OCH nedladdat + visuellt öppnat och synat 2026-07-11 (flera slumpvis provade
// id:n gav 200 men visade sig vara helt fel motiv — hundvalp, tomat, YouTube-
// skärmdump, konsertlokal — så bara det som faktiskt VISAT sig vara rätt motiv
// vid granskning listas här). Lokal u() — INGEN värde-import från
// theme-content.ts (bara `import type` är tillåtet från delade moduler; en
// värde-import hit skulle skapa en cirkulär import eftersom theme-content.ts
// importerar FLORIST_CONTENT från registry.ts som importerar denna fil).
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  heroWide: u('1465146344425-f00d5f5c8f07'), // vallmo i vetefält — vild, öppen
  heroMoody: u('1533038590840-1cde6e668a91'), // mörk bukett: lila anemon, orange protea, röd ranunkel
  heroGreen: u('1509587584298-0f3b3a3a1797', 1200), // eukalyptusgren, porträttformat — mossgrönt
  g1: u('1490750967868-88aa4486c946', 900), // orange vallmo mot blå himmel
  g2: u('1457089328109-e5d9bd499191', 900), // solrosor i närbild
  g3: u('1519378058457-4c29a0a2efac', 900), // tätt fält av röda blommor
  g4: u('1502977249166-824b3a8a4d6d', 900), // rosa ros i glasflaska
  g5: u('1518895949257-7621c3c786d7', 900), // rosa ros mot rosa vägg
  g6: u('1462275646964-a0e3386b89fa', 900), // körsbärsblom mot blå himmel
  closing: u('1494972308805-463bc619d34e'), // mörkröda rosor mot svart — dramatisk
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1500648767791-00dcc994a43e', 700),
} as const

/**
 * WILD THISTLE — mörk tistel-lila + mossgrön + råpapper, rustik/vild (florist-
 * sviten, goal-58). Zivar: "får inte kännas som en mjuk morot — ska kännas som
 * ett svärd". EGEN sektionsordning (ingen annan mall i sviten har den): (1)
 * hero — bild och text i ETT asymmetriskt block nere till vänster (bruten
 * grid, tre foton i ojämna rutor), (2) "Så jobbar vi" — numrerad trio (01/02/
 * 03) i rå typografi, inga bilder, (3) shop-teasers med rakt avskurna bilder
 * (radius 0), (4) tjänster som en RÅ prislista (punkterad linje mellan namn
 * och pris — sfPriceBand/-Grid/-Row), (5) om med ett stort citat, (6) en
 * mossgrön kurser-CTA-remsa, (7) blogg (samma raka kort som butiken), (8)
 * galleri, (9) plats, (10) closing i eget mörka fullbredds-foto. Presentkort
 * vävs in som en smal rad mellan blogg och galleri — aldrig en egen sektion.
 * Se WildThistleLayout.tsx för sektionerna i sin helhet. Radie 0 rakt igenom,
 * tunga vikter (700/800) på all display-typografi — skarpt, aldrig mjukt.
 */
export const wildthistle: FloristTheme = {
  key: 'wildthistle',
  name: 'Wild Thistle',
  desc: 'Tistel-lila & mossgrönt · rustikt & vilt',
  palette: {
    primary: '#4b2e52',
    primaryD: '#2e1a34',
    bg: '#f1ead9',
    surface: '#f8f3e7',
    fg: '#201a16',
    fg2: '#6b5f52',
    line: '#ddd2ba',
    accentSoft: '#e2e6cd',
  },
  fonts: {
    // Playfair Display: klassisk hög-kontrast-serif som bär tunga vikter (700)
    // utan att bli klumpig — passar "svärd, inte morot". Inter: neutral
    // grotesk för mikrotext/brödtext, håller sig undan rubrikernas dramatik.
    display: 'var(--font-playfair), Georgia, serif',
    body: 'var(--font-inter), system-ui, sans-serif',
  },
  radius: '0px',
  content: {
    heroEyebrow: '— Vildvuxet & handbundet',
    heroTitle: 'Vilt plockat.\nBundet med tunga händer.',
    heroLede:
      'Tistlar, gräs och blommor som fått växa som de vill — bundna för hand i ett rustikt, jordnära formspråk. Inget är för perfekt för att duga.',
    tagline: 'Blommor som fått växa vilt',
    utility: 'Handbundet i säsong · Hämta i butiken eller få det levererat',
    italic: 'Det vackraste är sällan tuktat — låt blommorna få vara vilda.',
    aboutCopy:
      'Vi väljer det som vuxit vilt och i säsong — tistlar, gräs, grenar och blommor med karaktär — och binder det för hand i ett rustikt, oförskönat formspråk. Inget är för perfekt för att duga.',
    servicesEyebrow: '— Handbundet, prissatt rakt av',
    servicesTitle: 'Priser',
    aboutTitle: 'Vildvuxet, bundet med tunga händer',
    teamEyebrow: '— Händerna bakom',
    teamTitle: 'Floristerna som binder vilt',
    heroImages: [IMG.heroWide, IMG.heroMoody, IMG.heroGreen],
    galleryImages: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6],
    aboutImage: IMG.heroMoody,
    closingImage: IMG.closing,
    team: [
      { name: 'Vårt team', role: 'Florister på fältet', img: IMG.p1 },
      { name: 'Binderi', role: 'Handbundet, dagligen', img: IMG.p2 },
    ],
    stats: [
      ['Vilt', 'plockat i säsong'],
      ['Handbundet', 'rakt av'],
      ['Rustikt', 'aldrig tuktat'],
    ],
    shopEyebrow: '— Ur butiken',
    shopTitle: 'Rakt från fältet',
    shopCta: 'Handla i butiken',
    blogEyebrow: '— Fältanteckningar',
    blogTitle: 'Säsong, växtlighet & vildvuxet',
    blogCta: 'Läs mer',
    giftEyebrow: '— Presentkort',
    giftLede: 'Ge bort något som fått växa vilt.',
    giftCta: 'Till presentkorten',
    closingTitle: 'Redo för något vilt vackert?',
    closingLede: 'Beställ en bukett, boka en kurskväll eller kom förbi butiken — vi binder det medan du väntar.',
    galleryEyebrow: '— Galleri',
    findEyebrow: '— Hitta till butiken',
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: true },
}
