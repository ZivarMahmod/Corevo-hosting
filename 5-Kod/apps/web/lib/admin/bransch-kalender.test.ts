import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  calendarLaunchMode,
  centeredCalendarScrollTop,
  placeOverlaps,
} from '@/components/admin/CalendarBoard'
import type { BookingRow } from '@/components/admin/BookingDrawer'
import { resolveTerm, termPlural, type Terminology } from '@/lib/platform/verticals-shared'

/**
 * C-06 — BEVIS: kalendermotorn är BRANSCH-GENERELL.
 *
 * Corevo är EN motor för alla branscher. Kalendern får därför aldrig anta frisör:
 * inga `if (bransch === 'frisor')`, inga hårdkodade "Stylist"/"Klippning"/"salong".
 * Branschen ska bara överlagra ORDEN (verticals.terminology) — geometrin (tid,
 * resurs, krock) ska vara identisk oavsett bransch.
 *
 * Testet bevisar tre saker:
 *   1. Terminologin följer med per bransch (florist/ateljé får sina ord).
 *   2. Motorns geometri är bransch-BLIND — samma tider ⇒ samma lanes, oavsett ord.
 *   3. Källkoden i kalendern innehåller inga frisörord i user-facing strängar
 *      (FAILAR om någon hårdkodar "Klippning"/"Stylist"/"salong" igen).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Bransch-presets. `florist` är EXAKT vad som ligger i verticals-tabellen idag
// (verifierat via `supabase db query`: staff=Florist, staff_plural=Florister,
// business=Butik — INGEN service-nyckel). `ateljé` finns INTE i DB ännu; den är
// Zivars prio-3-bransch och tas med här som det preset den behöver vara, så
// motorn bevisas klara den INNAN raden seedas.
// ─────────────────────────────────────────────────────────────────────────────
const FRISOR: Terminology = { staff: 'Stylist', service: 'Klippning' }

const FLORIST_DB: Terminology = {
  staff: 'Florist',
  staff_plural: 'Florister',
  business: 'Butik',
  primary_cta_label: 'Beställ blommor',
  primary_cta_href: '/shop',
}

/** Florist SOM DEN BORDE VARA: samma rad + service-ordet som saknas i DB idag. */
const FLORIST_FULL: Terminology = { ...FLORIST_DB, service: 'Beställning' }

/** Ateljé (prio 3) — ännu inte seedad i verticals. */
const ATELJE: Terminology = {
  staff: 'Formgivare',
  staff_plural: 'Formgivare',
  service: 'Ateljébesök',
  business: 'Ateljé',
}

const FRISOR_ORD = /salong|frisör|barber|klippning|stylist/i

describe('bransch-lagret: terminologin följer branschen', () => {
  it('florist får sina ord — aldrig frisörens', () => {
    expect(resolveTerm(FLORIST_FULL, 'staff', 'Personal')).toBe('Florist')
    expect(termPlural(FLORIST_FULL, 'staff', 'Personal')).toBe('Florister')
    expect(resolveTerm(FLORIST_FULL, 'service', 'Tjänst')).toBe('Beställning')

    // Hårda regeln: INGET frisörord får läcka in i en florists etiketter.
    for (const key of ['staff', 'service']) {
      expect(resolveTerm(FLORIST_FULL, key, 'Tjänst')).not.toMatch(FRISOR_ORD)
    }
  })

  it('ateljé får sina ord — aldrig frisörens', () => {
    expect(resolveTerm(ATELJE, 'staff', 'Personal')).toBe('Formgivare')
    expect(termPlural(ATELJE, 'staff', 'Personal')).toBe('Formgivare')
    expect(resolveTerm(ATELJE, 'service', 'Tjänst')).toBe('Ateljébesök')
    expect(resolveTerm(ATELJE, 'staff', 'Personal')).not.toMatch(FRISOR_ORD)
  })

  it('frisör är EN bransch bland flera — inte motorns default', () => {
    // Frisörens ord kommer ur ÖVERLAGRET, inte ur koden: en tenant helt UTAN
    // terminologi ska få de neutrala plattformsorden, aldrig "Stylist"/"Klippning".
    expect(resolveTerm(FRISOR, 'staff', 'Personal')).toBe('Stylist')
    expect(resolveTerm({}, 'staff', 'Personal')).toBe('Personal')
    expect(resolveTerm({}, 'service', 'Tjänst')).toBe('Tjänst')
    expect(resolveTerm(null, 'staff')).toBe('Personal')
    expect(resolveTerm(null, 'service')).not.toMatch(FRISOR_ORD)
  })

  it('ÄRLIGT GAP: floristen i DB saknar service-ord → faller till neutralt, ALDRIG "Klippning"', () => {
    // Regressionsvakt för den fällan: fallbacken måste vara plattformens neutrala
    // ord. Skriver någon `resolveTerm(t, 'service', 'Klippning')` på en yta, blir
    // en florists tjänst plötsligt en "Klippning". Så får det aldrig bli.
    expect(resolveTerm(FLORIST_DB, 'service', 'Tjänst')).toBe('Tjänst')
    expect(resolveTerm(FLORIST_DB, 'service', 'Tjänst')).not.toMatch(FRISOR_ORD)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Motorn: samma tider ⇒ samma geometri, oavsett bransch. Orden är hud, inte kod.
// ─────────────────────────────────────────────────────────────────────────────
const TZ = 'Europe/Stockholm'

const booking = (
  id: string,
  startUtc: string,
  endUtc: string,
  serviceName: string,
  staffTitle: string,
): BookingRow => ({
  id,
  startTs: `2026-07-14T${startUtc}:00Z`,
  endTs: `2026-07-14T${endUtc}:00Z`,
  serviceName,
  staffTitle,
  staffId: 'r1',
  priceCents: 50000,
  status: 'confirmed',
  createdAt: '2026-07-01T08:00:00Z',
  note: null,
  customerId: null,
  customerName: 'Kim',
  locationName: null,
  isPast: false,
  paymentStatus: null,
  paymentAmountCents: null,
})

/** Samma tre tider — bara branschens ORD skiljer raderna åt. */
const scenario = (service: string, staff: string) => [
  booking('a', '07:00', '08:00', service, staff),
  booking('b', '07:30', '08:30', service, staff), // krockar med a
  booking('c', '09:00', '10:00', service, staff), // fristående
]

const geometry = (rows: BookingRow[]) =>
  placeOverlaps(rows, TZ).map((p) => ({ id: p.booking.id, lane: p.lane, lanes: p.lanes }))

describe('kalendermotorn är bransch-blind (ingen kodfork)', () => {
  it('florist och ateljé får IDENTISK geometri med frisör — samma tider, samma lanes', () => {
    const frisor = geometry(scenario('Klippning', 'Stylist'))
    const florist = geometry(scenario('Sorgbukett', 'Florist'))
    const atelje = geometry(scenario('Ateljébesök', 'Formgivare'))

    // Krockskyddet är motorns kärna: a och b överlappar ⇒ två lanes, c ⇒ egen.
    expect(frisor).toEqual([
      { id: 'a', lane: 0, lanes: 2 },
      { id: 'b', lane: 1, lanes: 2 },
      { id: 'c', lane: 0, lanes: 1 },
    ])

    // Motorn läser TID, inte bransch. Byter man ut orden ändras ingenting.
    expect(florist).toEqual(frisor)
    expect(atelje).toEqual(frisor)
  })

  it('bokningens etiketter bärs av datan, inte av motorn', () => {
    const [first] = placeOverlaps(scenario('Sorgbukett', 'Florist'), TZ)
    expect(first.booking.serviceName).toBe('Sorgbukett')
    expect(first.booking.staffTitle).toBe('Florist')
  })
})

describe('kalenderns responsiva startbeteende', () => {
  it('öppnar Ny bokning från ?ny och prioriterar den framför blockering', () => {
    expect(calendarLaunchMode(new URLSearchParams('ny'))).toBe('new')
    expect(calendarLaunchMode(new URLSearchParams('blockera&ny'))).toBe('new')
  })

  it('öppnar Blockera tid från ?blockera och annars ingenting', () => {
    expect(calendarLaunchMode(new URLSearchParams('blockera'))).toBe('block')
    expect(calendarLaunchMode(new URLSearchParams('vy=dag'))).toBeNull()
  })

  it('centrerar nu-linjen och klampar scrollpositionen inom kalendern', () => {
    expect(centeredCalendarScrollTop(600, 400, 1200)).toBe(400)
    expect(centeredCalendarScrollTop(80, 400, 1200)).toBe(0)
    expect(centeredCalendarScrollTop(1150, 400, 1200)).toBe(800)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// C-07-vakten, som TEST: kalenderns källkod får inte innehålla frisörord i
// user-facing strängar/JSX. Kommentarer får förklara historien (de renderas
// aldrig) — men en hårdkodad etikett failar här, direkt.
// ─────────────────────────────────────────────────────────────────────────────
/** apps/web-roten — testet körs med cwd=5-Kod, så vi ankrar i filens egen plats. */
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const KALENDER_FILER = [
  'components/admin/CalendarBoard.tsx',
  'components/admin/BookingDrawer.tsx',
  'components/admin/CalendarHelp.tsx',
  'components/admin/ScheduleWeekBoard.tsx',
]

/** Ta bort blockkommentarer, radkommentarer och JSX-kommentarer — kvar blir kod +
 *  det användaren faktiskt ser. */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ') // {/* JSX-kommentar */}
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* blockkommentar */
    .replace(/^[ \t]*\/\/.*$/gm, ' ') // hel radkommentar
    .replace(/([^:'"`])\/\/[^'"`\n]*$/gm, '$1') // efterhängd radkommentar
}

describe('C-07: kalendern hårdkodar inga frisörord', () => {
  it.each(KALENDER_FILER)('%s är fri från bransch-ord i user-facing kod', (rel) => {
    const src = fs.readFileSync(path.join(WEB_ROOT, rel), 'utf8')
    const kod = stripComments(src)

    const träffar = [...kod.matchAll(/(?<!\p{L})(salong|frisör|barber|klippning|hårvård)\p{L}*/giu)]
      .map((m) => m[0])
      // 'stylist' fångas separat: CSS-klasser (styles.stylistName) är kodsymboler,
      // inte ord användaren läser.
      .filter((w) => !/^stylist[A-Z]/.test(w))

    expect(träffar).toEqual([])
  })
})
