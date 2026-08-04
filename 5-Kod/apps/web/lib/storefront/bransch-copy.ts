/**
 * Branch owns wording; theme owns presentation. Precedence is tenant copy,
 * database defaults, these code defaults, then theme defaults. Keys must stay
 * within CopyOverride; utility text remains theme-owned.
 */

import type { CopyOverride } from './theme-copy'

// ─────────────────────────────────────────────────────────────────────────────
// COPY per bransch
// ─────────────────────────────────────────────────────────────────────────────

const FRISOR: CopyOverride = {
  heroEyebrow: '— Frisörsalong',
  heroTitle: 'Skarpt klippt.\nSkönt mottagen.',
  heroLede: 'En stilla salong där varje klippning får ta sin tid. Boka en stund som är helt din.',
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
  servicesIntro: 'Nybyggnad, fyllning, gellack och manikyr — alltid med hållbarheten i fokus.',
  teamEyebrow: '— Våra nagelteknologer',
  teamTitle: 'Händerna bakom formen',
  teamLead: 'Nagelteknologer med öga för detaljen.',
  closingEyebrow: '— Välkommen in',
  closingTitle: 'Dags för en påfyllning?',
  closingLede: 'Boka en tid som passar dig — vi tar hand om resten.',
  contactEyebrow: '— Hitta hit',
  contactTitle: 'Studion & öppettider',
}

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

/** Neutral wording for tenants without a specialized vertical. */
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

/** Code defaults keyed by `verticals.key`, including accepted spelling aliases. */
export const BRANSCH_COPY: Record<string, CopyOverride> = {
  frisör: FRISOR,
  barbershop: BARBERSHOP,
  nagelstudio: NAGELSTUDIO,
  restaurang: RESTAURANG,
  generell: GENERELL,
  florist: FLORIST,
  tatuering: TATUERING,
  massage: MASSAGE,
  klinik: KLINIK,
  hudvard: HUDVARD,
  frisor: FRISOR,
  barberare: BARBERSHOP,
  hudvård: HUDVARD,
  tatuerare: TATUERING,
  tattoo: TATUERING,
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking terms
// ─────────────────────────────────────────────────────────────────────────────
/** Branch-specific booking terms. Staff terminology remains owned by `verticals`. */
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
  frisör: BOKNING_TID,
  frisor: BOKNING_TID,
  barbershop: BOKNING_TID,
  barberare: BOKNING_TID,
  nagelstudio: BOKNING_TID,
  massage: BOKNING_TID,
  hudvard: BOKNING_TID,
  hudvård: BOKNING_TID,
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

/** Unknown branches use neutral booking terms. */
export function branschBokning(verticalId: string | null | undefined): BranschBokning {
  if (!verticalId) return DEFAULT_BOKNING
  return BRANSCH_BOKNING[verticalId] ?? DEFAULT_BOKNING
}

/** Unknown branches leave the theme copy unchanged. */
export function branschCopy(verticalId: string | null | undefined): CopyOverride {
  if (!verticalId) return {}
  return BRANSCH_COPY[verticalId] ?? {}
}
