// BRANSCH-LAGRET — branschen äger ORDEN, mallen äger FORMEN.
//
// Zivars krav (ordagrant): "när jag skapar en tatueringsstudio ska de inte vara en
// mall som säger välkommen till din slaong. branschen avgör mycket av vad som
// kommer stå."
//
// Problemet det löser: `verticals.default_copy` (migration 0055) är TOM i DB → bransch-
// lagret levererade {} → mallens hårdkodade FRISÖR-copy i THEME_CONTENT läckte till
// ALLA branscher (floristen fick "Välkommen till salongen", tatueraren likaså). Den
// här filen är KOD-DEFAULTEN för det lagret: den finns tills Zivar fyller
// verticals.default_copy, och DB vinner över den i samma sekund han gör det.
//
// Upplösningskedjan (oförändrad — vi fyller bara det tomma mellanlagret):
//   ägarens settings.copy  →  BRANSCH (DB default_copy → denna fil)  →  temats THEME_CONTENT
//
// KONTRAKT: nycklarna nedan är EXAKT `CopyOverride` (theme-content.ts). Inga nya
// nycklar uppfinns här — en okänd nyckel skulle tyst falla bort i cleanCopyOverride.
// OBS: `utility` (topp-remsan) är MEDVETET inte redigerbar (den är tema-default
// alltid, se CopyOverride-doc) → den kan inte sättas per bransch, och görs inte.
//
// NYCKELN = `verticals.key` — de RIKTIGA nycklarna i DB (migration 0028/0030 + den
// ad-hoc-seedade 'florist', se 0056). Notera 'frisör' MED ö och 'barbershop' (inte
// "barberare"). Uppslag sker på nyckel → en bransch som ännu inte finns i DB skadar
// inget; den ligger laddad och gäller den dag Zivar seedar raden.

import type { CopyOverride } from './theme-content'

/** Foto-standard per bransch — samma fyra fält som mallen levererar i ThemeContent. */
export type BranschMedia = {
  heroImages: string[]
  galleryImages: string[]
  aboutImage: string
  closingImage: string
}

// Samma u()-hjälpare/format som images.ts + theme-content.ts.
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

// ── Foto-id:n: BARA sådana som REDAN finns i repot (theme-content.ts / images.ts /
// florist-sviten) och därmed är verifierade i drift. Ett påhittat Unsplash-id är
// inte "nästan rätt" — det är 404 och en trasig hero hos en riktig kund. Därför
// seedas media bara för de branscher där repot har verifierade foton; övriga
// branscher får sin COPY (det Zivar faktiskt bad om: vad som STÅR) och låter
// bilden falla igenom till mallens default tills riktiga foton är verifierade.
const IMG = {
  // salong / hår (theme-content.ts)
  salonInterior: u('1521590832167-7bcbfaa6381f'),
  salonChairs: u('1560066984-138dadb4c035'),
  styling: u('1633681926035-ec1ac984418a'),
  cutting: u('1599351431202-1e0f0137899a'),
  washing: u('1595476108010-b4d1f102b1b1'),
  color: u('1522336572468-97b06e8ef143'),
  // barber (theme-content.ts)
  barberShop: u('1585747860715-2ba37e788b70'),
  barberCut: u('1503951914875-452162b0f3f1'),
  barberTools: u('1622286342621-4bd786c2447c'),
  beard: u('1621605815971-fbc98d665033'),
  // galleri (theme-content.ts)
  g1: u('1605497788044-5a32c7078486', 900),
  g2: u('1492106087820-71f1a00d2b11', 900),
  g3: u('1487412947147-5cebf100ffc2', 900),
  g4: u('1519699047748-de8e457a634e', 900),
  g5: u('1559599101-f09722fb4948', 900),
  g6: u('1457972729786-0411a3b2b626', 900),
} as const

// Blommor (theme-content.ts FLORA_IMG — verifierade 200 OK 2026-07-11).
const FLORA = {
  shop: u('1487530811176-3780de880c2d'),
  bouquet: u('1490750967868-88aa4486c946'),
  peonies: u('1462275646964-a0e3386b89fa'),
  work: u('1526047932273-341f2a7631f9'),
  wildflowers: u('1470509037663-253afd7f0f51'),
  ranunculus: u('1494972308805-463bc619d34e'),
  vase: u('1502977249166-824b3a8a4d6d'),
  greenhouse: u('1466692476868-aef1dfb1e735'),
  bouquet2: u('1508610048659-a06b669e3321', 900),
  rose: u('1518895949257-7621c3c786d7', 900),
  field: u('1500382017468-9049fed747ef', 900),
} as const

// ─────────────────────────────────────────────────────────────────────────────
// COPY per bransch
// ─────────────────────────────────────────────────────────────────────────────

/** FRISÖR — texten är INTE fel, den var bara felplacerad. Den låg hårdkodad i
 *  THEME_CONTENT.salvia (frisör-branschens default_template enligt 0028) och
 *  flyttar nu HEM till sin bransch, ordagrant. Ett tema-lager som neutraliseras
 *  får därför inte frisören att tappa sin röst — han får den härifrån i stället,
 *  på VILKEN mall han än står. */
const FRISOR: CopyOverride = {
  heroEyebrow: '— Frisörsalong',
  heroTitle: 'Skarpt klippt.\nSkönt mottagen.',
  heroLede:
    'En stilla salong där varje klippning får ta sin tid. Boka en stund som är helt din.',
  tagline: 'Hårvård med lugn hand',
  italic: 'Varje stol är en stund för sig själv.',
  aboutCopy:
    'Hos oss ska ett frisörbesök kännas som en paus, inte ett ärende. Vi är ett litet team som bryr oss om hantverket och om dig som sitter i stolen.',
  aboutTitle: 'Hantverk, kvalitet och personlig service',
  servicesEyebrow: '— Behandlingar & priser',
  servicesTitle: 'Tjänster',
  servicesIntro:
    'Klippning, färg och behandlingar — alltid med tid för konsultation innan vi börjar.',
  teamEyebrow: '— Våra frisörer',
  teamTitle: 'Människorna bakom stolen',
  teamLead: 'Erfarna frisörer som lyssnar först och klipper sedan.',
  closingEyebrow: '— Välkommen in',
  closingTitle: 'Dags för något nytt?',
  closingLede: 'Boka en tid som passar dig — vi tar hand om resten.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Plats & öppettider',
}

/** BARBERSHOP — ordagrant från THEME_CONTENT.zigge (barbershoppens default_template
 *  enligt 0030). Rätt ord, fel lager: flyttar hem. */
const BARBERSHOP: CopyOverride = {
  heroEyebrow: '— Frisör & barberare',
  heroTitle: 'RENT SNITT.\nINGEN KRÅNGEL.',
  heroLede:
    'Klippning och skäggvård för alla. Drop in eller boka online — du sitter i stolen samma dag.',
  tagline: 'Frisör & barberare',
  italic: 'Av frisörer, för alla.',
  aboutCopy:
    'Hörnsalongen där frisör möter barberare. Vi håller det enkelt, vasst och prisvärt — och vi minns hur du gillar din fade.',
  aboutTitle: 'RENT HANTVERK, INGEN KRÅNGEL',
  servicesEyebrow: '— Klipp, skägg & priser',
  servicesTitle: 'TJÄNSTER',
  servicesIntro: 'Fade, skäggtrim och rakkniv. Inga påslag, inga överraskningar.',
  teamEyebrow: '— Teamet',
  teamTitle: 'KILLARNA & TJEJERNA BAKOM STOLEN',
  teamLead: 'Barberare med saxen i handen sedan länge.',
  closingEyebrow: '— Drop in',
  closingTitle: 'DAGS FÖR EN FRÄSCH FADE?',
  closingLede: 'Kom förbi eller boka online — du sitter i stolen idag.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Plats & öppettider',
}

/** TATUERING — Zivars uttryckliga exempel. En tatuerare säljer INTE "en stund i
 *  stolen" utan ett beslut man bär hela livet: konsultation, skiss, respekt för
 *  huden. Inget "salong", ingen "klippning", ingen "frisör". */
const TATUERING: CopyOverride = {
  heroEyebrow: '— Tatueringsstudio',
  heroTitle: 'Bläck som\nhåller livet ut.',
  heroLede:
    'En studio för dig som vill bära något genomtänkt. Vi ritar för hand, arbetar sterilt och tar aldrig genvägar.',
  tagline: 'Tatuering med hantverket först',
  italic: 'Ett bra motiv får ta den tid det tar.',
  aboutCopy:
    'Vi tatuerar för dig som vill ha något eget — inte något från väggen. Varje motiv börjar med ett samtal och en skiss, och först när du känner att den är rätt sätter vi nålen. Steril miljö, egna ritningar och full respekt för att det du bär ska sitta resten av livet.',
  aboutTitle: 'Egna skisser, stadig hand',
  servicesEyebrow: '— Stilar & prisbild',
  servicesTitle: 'Vad vi tatuerar',
  servicesIntro:
    'Från fine line till blackwork och täckning av gammalt bläck. Konsultationen är alltid kostnadsfri.',
  teamEyebrow: '— Våra tatuerare',
  teamTitle: 'Konstnärerna bakom nålen',
  teamLead: 'Varje tatuerare har sin stil — hitta den som matchar din idé.',
  closingEyebrow: '— Boka konsultation',
  closingTitle: 'Har du en idé?',
  closingLede: 'Berätta vad du vill bära, så ritar vi fram den tillsammans.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Studion & öppettider',
}

/** NAGELSTUDIO — default_template är `linnea`, vars copy är HÅRVÅRD ("Naturligt
 *  vacker", "friskt hår"). Exakt läckan Zivar beskriver. Här är den riktiga texten. */
const NAGELSTUDIO: CopyOverride = {
  heroEyebrow: '— Nagelstudio',
  heroTitle: 'Naglar som\nbär hela vägen.',
  heroLede:
    'Fyllningar, förstärkning och nagelvård med precision. Boka en stund där händerna får all uppmärksamhet.',
  tagline: 'Nagelvård med precision',
  italic: 'Detaljen syns i varje handrörelse.',
  aboutCopy:
    'Vi arbetar med naglar som ska hålla i vardagen — starkt fäste, ren form och en finish som sitter kvar. Hos oss får du en nagelteknolog som tar sig tid att titta på dina naturliga naglar först, och bygger utifrån dem.',
  aboutTitle: 'Precision, hållbarhet och omsorg',
  servicesEyebrow: '— Behandlingar & priser',
  servicesTitle: 'Behandlingar',
  servicesIntro:
    'Nybyggnad, fyllning, gellack och manikyr — alltid med hållbarheten i fokus.',
  teamEyebrow: '— Våra nagelteknologer',
  teamTitle: 'Händerna bakom formen',
  teamLead: 'Nagelteknologer med öga för detaljen.',
  closingEyebrow: '— Välkommen in',
  closingTitle: 'Dags för en påfyllning?',
  closingLede: 'Boka en tid som passar dig — vi tar hand om resten.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Studion & öppettider',
}

/** MASSAGE — kropp och återhämtning, inte "behandling i stolen". */
const MASSAGE: CopyOverride = {
  heroEyebrow: '— Massage & kroppsvård',
  heroTitle: 'Spänningar släpper.\nAxlarna sjunker.',
  heroLede:
    'Massage för dig som sitter still för mycket eller tränar för hårt. Boka en timme där kroppen får komma ikapp.',
  tagline: 'Massage som gör verklig skillnad',
  italic: 'Kroppen minns det du inte hinner känna.',
  aboutCopy:
    'Vi arbetar med händerna och lyssnar på kroppen. Oavsett om det är nacken efter en lång vecka vid skärmen eller vaderna efter milen du sprang, börjar vi med att hitta var det faktiskt sitter — och behandlar där, inte där det bara känns.',
  aboutTitle: 'Trygga händer, verklig effekt',
  servicesEyebrow: '— Behandlingar & priser',
  servicesTitle: 'Behandlingar',
  servicesIntro:
    'Klassisk massage, idrottsmassage och djupgående behandling — 30, 60 eller 90 minuter.',
  teamEyebrow: '— Våra massörer',
  teamTitle: 'Händerna som hittar rätt',
  teamLead: 'Utbildade massörer med känsla för var det sitter.',
  closingEyebrow: '— Boka tid',
  closingTitle: 'Stel i nacken?',
  closingLede: 'Boka en tid — kroppen tackar dig efteråt.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Mottagningen & öppettider',
}

/** KLINIK — medicinsk ton: legitimation, trygghet, diskretion. Ingen "salong". */
const KLINIK: CopyOverride = {
  heroEyebrow: '— Klinik',
  heroTitle: 'Trygg vård,\nnära dig.',
  heroLede:
    'Legitimerad personal, korta väntetider och tid att faktiskt lyssna. Boka ett besök som utgår från dig.',
  tagline: 'Professionell vård med patienten i fokus',
  italic: 'Ett bra möte börjar med att någon lyssnar.',
  aboutCopy:
    'Vi är en klinik där du möter legitimerad personal och slipper känna dig som ett nummer i kön. Vi tar oss tid för anamnesen, förklarar vad vi ser och lägger en plan tillsammans med dig. Diskretion och patientsäkerhet är självklarheter, inte tillval.',
  aboutTitle: 'Kompetens, trygghet och diskretion',
  servicesEyebrow: '— Behandlingar & priser',
  servicesTitle: 'Våra behandlingar',
  servicesIntro:
    'Konsultation, utredning och behandling — alltid med en tydlig plan innan vi börjar.',
  teamEyebrow: '— Vår personal',
  teamTitle: 'Personalen på kliniken',
  teamLead: 'Legitimerad personal med lång erfarenhet.',
  closingEyebrow: '— Boka besök',
  closingTitle: 'Behöver du hjälp?',
  closingLede: 'Boka ett besök — vi tar hand om dig från första samtalet.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Kliniken & öppettider',
}

/** HUDVÅRD — hy, inte hår. */
const HUDVARD: CopyOverride = {
  heroEyebrow: '— Hudvårdssalong',
  heroTitle: 'Din hy,\nläst på riktigt.',
  heroLede:
    'Ansiktsbehandlingar som utgår från din hy — inte från ett standardprotokoll. Boka en analys och en behandling som faktiskt passar.',
  tagline: 'Hudvård utifrån din hy',
  italic: 'Frisk hy är inget filter — det är omsorg över tid.',
  aboutCopy:
    'Vi börjar alltid med att läsa av din hy innan vi rör den. Torr, känslig, oren eller stressad — behandlingen läggs upp därefter, med produkter vi kan stå för och råd du kan använda hemma. Målet är inte en snabb glow, utan en hy som mår bra länge.',
  aboutTitle: 'Analys först, behandling sedan',
  servicesEyebrow: '— Behandlingar & priser',
  servicesTitle: 'Ansiktsbehandlingar',
  servicesIntro:
    'Djuprengöring, peeling, fillers av fukt och lugnande behandlingar — efter din hudanalys.',
  teamEyebrow: '— Våra hudterapeuter',
  teamTitle: 'Terapeuterna bakom huden',
  teamLead: 'Diplomerade hudterapeuter som ser skillnad på hy och hy.',
  closingEyebrow: '— Boka tid',
  closingTitle: 'Vill du veta vad din hy behöver?',
  closingLede: 'Boka en hudanalys — vi börjar där.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Salongen & öppettider',
}

/** FLORIST — finns i DB (0056 refererar key='florist'). Copyn speglar flora-temats
 *  evergreen-text, men bor nu i BRANSCHEN → gäller på alla 13 florist-mallar. */
const FLORIST: CopyOverride = {
  heroEyebrow: '— Blomsterbutik',
  heroTitle: 'Blommor,\nbundna för hand.',
  heroLede:
    'En blomsterbutik med hantverket i centrum. Buketter i säsong, binderier och kurser — bundna med omsorg.',
  tagline: 'Blomsterhantverk i säsong',
  italic: 'Var blomma har sin tid.',
  aboutCopy:
    'Vi brinner för blomsterhantverket — buketter bundna för hand, blommor i säsong och så närodlat som möjligt. Kvalitet och hållbarhet går hand i hand hos oss.',
  aboutTitle: 'Hantverk, säsong och omsorg',
  servicesEyebrow: '— Buketter & binderier',
  servicesTitle: 'Beställ hos oss',
  servicesIntro: 'Buketter, binderier och bröllop — alltid efter vad säsongen ger.',
  teamEyebrow: '— Vi i butiken',
  teamTitle: 'Floristerna bakom disken',
  teamLead: 'Florister med händerna i säsongens blommor varje dag.',
  closingEyebrow: '— Välkommen in',
  closingTitle: 'Blommor till någon du tycker om?',
  closingLede: 'Beställ online eller kom förbi butiken — vi binder medan du väntar.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Butiken & öppettider',
}

/** RESTAURANG — default_template är `leander` (frisör-copy: "Din frisör i lugn och
 *  ro", "hårfärg"). Läckan igen. Riktig restaurangtext här. */
const RESTAURANG: CopyOverride = {
  heroEyebrow: '— Restaurang',
  heroTitle: 'Råvaran först.\nResten följer.',
  heroLede:
    'Ett kök som lagar efter säsong och en sal där man gärna stannar kvar. Boka ett bord — vi dukar för er.',
  tagline: 'Säsongens råvaror, lagat från grunden',
  italic: 'Det bästa som serveras är tid tillsammans.',
  aboutCopy:
    'Vi lagar mat från grunden på det säsongen ger, och vi köper hellre lite och bra än mycket och medelmåttigt. Menyn ändras när råvaran gör det. Kom som du är, stanna så länge du vill — här är gästen aldrig ett bord som ska omsättas.',
  aboutTitle: 'Från grunden, efter säsong',
  servicesEyebrow: '— Meny & priser',
  servicesTitle: 'Vår meny',
  servicesIntro: 'Menyn skiftar med säsongen — det här står på den just nu.',
  teamEyebrow: '— Köket & salen',
  teamTitle: 'Människorna bakom maten',
  teamLead: 'Ett kök och en sal som tycker om det de gör.',
  closingEyebrow: '— Boka bord',
  closingTitle: 'Hungrig?',
  closingLede: 'Boka ett bord — vi ser fram emot att laga åt er.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Restaurangen & öppettider',
}

/** GENERELL — bransch-NEUTRAL (verticals.terminology för 'generell' är medvetet {}).
 *  default_template är `edit`, vars copy är HÅRSTUDIO ("Form, färg och finess", "Ett
 *  klipp är arkitektur för håret"). En kund utan bransch ska INTE få hårjargong —
 *  den ska få ord som passar vilken verksamhet som helst. */
const GENERELL: CopyOverride = {
  heroEyebrow: '— Välkommen',
  heroTitle: 'Välkommen\ntill oss.',
  heroLede:
    'Vi tar hand om dig från första kontakt till avslutat besök. Boka en tid som passar dig.',
  tagline: 'Personlig service, varje gång',
  italic: 'Bra arbete börjar med att någon bryr sig.',
  aboutCopy:
    'Vi är ett litet team som bryr oss om hantverket och om dig som kund. Vi tar oss tid, gör det ordentligt och ser till att du går härifrån nöjd.',
  aboutTitle: 'Kvalitet och personlig service',
  servicesEyebrow: '— Tjänster & priser',
  servicesTitle: 'Tjänster',
  servicesIntro: 'Det här kan vi hjälpa dig med.',
  teamEyebrow: '— Vårt team',
  teamTitle: 'Människorna bakom arbetet',
  teamLead: 'Ett team som tycker om det de gör.',
  closingEyebrow: '— Välkommen in',
  closingTitle: 'Dags att boka?',
  closingLede: 'Boka en tid som passar dig — vi tar hand om resten.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Plats & öppettider',
}

/**
 * Branschens standardtext, keyad på `verticals.key`.
 *
 * RIKTIGA nycklar i DB idag: 'frisör' (med ö!), 'barbershop', 'nagelstudio',
 * 'restaurang', 'generell' (0028 + 0030) och 'florist' (ad-hoc-seedad, se 0056).
 * Övriga nycklar nedan är FÖRBEREDDA — de skadar inget (uppslag på nyckel), och
 * gäller den dag Zivar seedar branschen. ASCII-aliasen finns för att en nyckel med
 * 'ö' är lätt att stava fel på vägen in.
 */
export const BRANSCH_COPY: Record<string, CopyOverride> = {
  // — finns i DB —
  'frisör': FRISOR,
  barbershop: BARBERSHOP,
  nagelstudio: NAGELSTUDIO,
  restaurang: RESTAURANG,
  generell: GENERELL,
  florist: FLORIST,
  // — förberedda (seeda verticals-raden så gäller de direkt) —
  tatuering: TATUERING,
  massage: MASSAGE,
  klinik: KLINIK,
  hudvard: HUDVARD,
  // — alias/stavningsvarianter mot samma bransch —
  frisor: FRISOR,
  barberare: BARBERSHOP,
  'hudvård': HUDVARD,
  tatuerare: TATUERING,
  tattoo: TATUERING,
}

/**
 * Branschens FOTO-standard, keyad på `verticals.key`.
 *
 * Salongsfoton är mallens default idag och ärvs av alla — det är buggen (floristen
 * fick frisörbilder). Här får branschen sina egna.
 *
 * MEDVETET GLES: bara branscher där repot har foto-id:n som redan är i drift (och
 * därmed verifierade) finns med. Ett påhittat Unsplash-id renderar en trasig bild
 * hos en riktig kund — sämre än en neutral bild. För övriga branscher faller bilden
 * igenom till mallens default tills riktiga id:n är verifierade; COPYN (det Zivar
 * bad om) gäller ändå. Lägg till en bransch = en rad här, inget annat.
 */
export const BRANSCH_IMAGES: Record<string, BranschMedia> = {
  'frisör': {
    heroImages: [IMG.salonInterior, IMG.styling, IMG.salonChairs],
    galleryImages: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6],
    aboutImage: IMG.washing,
    closingImage: IMG.salonChairs,
  },
  barbershop: {
    heroImages: [IMG.barberShop, IMG.barberCut, IMG.barberTools],
    galleryImages: [IMG.barberCut, IMG.beard, IMG.barberShop, IMG.barberTools, IMG.g6, IMG.cutting],
    aboutImage: IMG.barberTools,
    closingImage: IMG.barberShop,
  },
  florist: {
    heroImages: [FLORA.shop, FLORA.bouquet, FLORA.peonies],
    galleryImages: [FLORA.bouquet2, FLORA.ranunculus, FLORA.vase, FLORA.wildflowers, FLORA.rose, FLORA.field],
    aboutImage: FLORA.work,
    closingImage: FLORA.greenhouse,
  },
}
// Alias → samma media som sin bransch.
BRANSCH_IMAGES.frisor = BRANSCH_IMAGES['frisör']!
BRANSCH_IMAGES.barberare = BRANSCH_IMAGES.barbershop!

// ─────────────────────────────────────────────────────────────────────────────
// BOKNINGSFLÖDETS ORD (goal-62)
// ─────────────────────────────────────────────────────────────────────────────
// Bokningen hårdkodade "Boka tid hos X" / "Boka tid online" / aria "Boka tid hos …"
// på fem ställen. En florist bokar inte "tid" — hen bokar en KONSULTATION; en
// restaurang bokar BORD; en klinik ett BESÖK. Verben fanns redan i copy-lagret
// (closingEyebrow), men bokningsflödet läste dem aldrig. Här bor de som EGNA
// nycklar så flödet kan slå upp dem direkt.
//
// SUBSTANTIVET för personalen kommer INTE härifrån — det ägs av
// `verticals.terminology` ('staff', se staff-noun.ts) och resolvas separat.
export type BranschBokning = {
  /** Knapp/CTA-verbet: "Boka tid", "Boka bord", "Boka konsultation". */
  cta: string
  /** Rubrik-prefixet före tenantens namn: `${hosPrefix} ${tenant.name}`. */
  hosPrefix: string
  /** Underrubriken på /boka. */
  lede: string
  /** Footerns tagline-prefix: `${online} · ${tenant.name}`. */
  online: string
}

/** Bransch-neutral fallback — en kund UTAN bransch ska inte få frisör-orden. */
export const DEFAULT_BOKNING: BranschBokning = {
  cta: 'Boka tid',
  hosPrefix: 'Boka tid hos',
  lede: 'Välj tjänst, personal och tid — klart på under en minut.',
  online: 'Boka online',
}

const BOKNING_TID: BranschBokning = {
  cta: 'Boka tid',
  hosPrefix: 'Boka tid hos',
  lede: 'Välj tjänst, personal och tid — klart på under en minut.',
  online: 'Boka tid online',
}

export const BRANSCH_BOKNING: Record<string, BranschBokning> = {
  'frisör': BOKNING_TID,
  frisor: BOKNING_TID,
  barbershop: BOKNING_TID,
  barberare: BOKNING_TID,
  nagelstudio: BOKNING_TID,
  massage: BOKNING_TID,
  hudvard: BOKNING_TID,
  'hudvård': BOKNING_TID,
  klinik: {
    cta: 'Boka besök',
    hosPrefix: 'Boka besök hos',
    lede: 'Välj behandling, vårdgivare och tid — bokat på under en minut.',
    online: 'Boka besök online',
  },
  restaurang: {
    cta: 'Boka bord',
    hosPrefix: 'Boka bord hos',
    lede: 'Välj sittning och tid — vi dukar för er.',
    online: 'Boka bord online',
  },
  florist: {
    cta: 'Boka konsultation',
    hosPrefix: 'Boka konsultation hos',
    lede: 'Välj vad du vill ha bundet, florist och tid — vi hör av oss om något behöver stämmas av.',
    online: 'Boka konsultation online',
  },
  tatuering: {
    cta: 'Boka konsultation',
    hosPrefix: 'Boka konsultation hos',
    lede: 'Välj vad du vill göra, tatuerare och tid — konsultationen är kostnadsfri.',
    online: 'Boka konsultation online',
  },
  tatuerare: {
    cta: 'Boka konsultation',
    hosPrefix: 'Boka konsultation hos',
    lede: 'Välj vad du vill göra, tatuerare och tid — konsultationen är kostnadsfri.',
    online: 'Boka konsultation online',
  },
  tattoo: {
    cta: 'Boka konsultation',
    hosPrefix: 'Boka konsultation hos',
    lede: 'Välj vad du vill göra, tatuerare och tid — konsultationen är kostnadsfri.',
    online: 'Boka konsultation online',
  },
  generell: DEFAULT_BOKNING,
}

/** Bokningsflödets ord för en bransch. PURE. Okänd/null → neutrala DEFAULT_BOKNING
 *  (aldrig frisör-orden — det är hela poängen med lagret). */
export function branschBokning(verticalId: string | null | undefined): BranschBokning {
  if (!verticalId) return DEFAULT_BOKNING
  return BRANSCH_BOKNING[verticalId] ?? DEFAULT_BOKNING
}

/** Branschens copy-default för en vertical. PURE. Okänd/null bransch → {} (=
 *  lagret är transparent, temat bestämmer som förr). */
export function branschCopy(verticalId: string | null | undefined): CopyOverride {
  if (!verticalId) return {}
  return BRANSCH_COPY[verticalId] ?? {}
}

/** Branschens foto-default för en vertical. PURE. Okänd/null bransch → null (=
 *  ingen bransch-media → mallens default gäller, exakt som idag). */
export function branschMedia(verticalId: string | null | undefined): BranschMedia | null {
  if (!verticalId) return null
  return BRANSCH_IMAGES[verticalId] ?? null
}
