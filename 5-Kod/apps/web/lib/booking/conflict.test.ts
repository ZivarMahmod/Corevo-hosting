// goal-67 — Konfliktlogiken, deterministiskt och utan DB.
//
// Två sanningar måste vara ÖVERENS:
//   1. DB:n  — `no_double_booking`: EXCLUDE USING gist (staff_id WITH =,
//              tstzrange(start_ts, end_ts) WITH &&) WHERE status IN
//              ('pending','confirmed','completed').
//   2. Koden — computeSlots() i lib/booking/availability.ts, som bestämmer
//              vilka tider en självbokande kund ens ERBJUDS.
//
// Vi speglar constrainten som en ren funktion (dbConflicts) och kör exakt samma
// överlappsfall genom BÅDA. Om de inte säger samma sak är det en bugg — antingen
// erbjuds en tid som DB:n kommer avvisa (kunden får ett fel efter att ha valt),
// eller så göms en tid som faktiskt är ledig.
import { describe, it, expect } from 'vitest'
import { computeSlots, type Interval } from './availability'

const T = (hhmm: string) => new Date(`2030-06-05T${hhmm}:00.000Z`)

type Row = { staffId: string; start: Date; end: Date; status: string }
const ACTIVE = ['pending', 'confirmed', 'completed']

/** Ren spegling av no_double_booking. tstzrange är '[)' — halvöppet. */
function dbConflicts(a: Row, b: Row): boolean {
  if (a.staffId !== b.staffId) return false
  if (!ACTIVE.includes(a.status) || !ACTIVE.includes(b.status)) return false
  // && på tstzrange: [aStart,aEnd) och [bStart,bEnd) delar minst en punkt.
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
}

const row = (start: string, end: string, status = 'confirmed', staffId = 'S1'): Row => ({
  staffId, start: T(start), end: T(end), status,
})

describe('no_double_booking — vad constrainten utesluter', () => {
  const bas = row('10:00', '11:00')

  it('exakt samma tid = krock', () => {
    expect(dbConflicts(bas, row('10:00', '11:00'))).toBe(true)
  })

  it('kant-mot-kant (slutar 11:00, nästa börjar 11:00) = TILLÅTET', () => {
    expect(dbConflicts(bas, row('11:00', '12:00'))).toBe(false)
    expect(dbConflicts(bas, row('09:00', '10:00'))).toBe(false)
  })

  it('inuti (helt innanför den befintliga) = krock', () => {
    expect(dbConflicts(bas, row('10:15', '10:45'))).toBe(true)
  })

  it('omslutande (större än den befintliga) = krock', () => {
    expect(dbConflicts(bas, row('09:00', '12:00'))).toBe(true)
  })

  it('delvis överlapp i båda riktningar = krock', () => {
    expect(dbConflicts(bas, row('09:30', '10:30'))).toBe(true)
    expect(dbConflicts(bas, row('10:30', '11:30'))).toBe(true)
  })

  it('en minuts överlapp räcker', () => {
    expect(dbConflicts(bas, row('10:59', '11:30'))).toBe(true)
  })

  it('annan resurs = ALDRIG krock (staff_id WITH =)', () => {
    expect(dbConflicts(bas, { ...row('10:00', '11:00'), staffId: 'S2' })).toBe(false)
  })

  it('cancelled och no_show blockerar INGENTING (WHERE-klausulen)', () => {
    expect(dbConflicts(row('10:00', '11:00', 'cancelled'), row('10:00', '11:00'))).toBe(false)
    expect(dbConflicts(row('10:00', '11:00', 'no_show'), row('10:00', '11:00'))).toBe(false)
    // …och två avbokade på samma tid får samexistera hur många som helst.
    expect(dbConflicts(row('10:00', '11:00', 'cancelled'), row('10:00', '11:00', 'cancelled'))).toBe(false)
  })

  it('completed blockerar (den ligger i WHERE-listan)', () => {
    expect(dbConflicts(row('10:00', '11:00', 'completed'), row('10:30', '11:30'))).toBe(true)
  })
})

describe('computeSlots — koden måste erbjuda exakt det DB:n accepterar', () => {
  const day = '2030-06-05'
  const tz = 'UTC'
  const base = {
    date: day,
    timeZone: tz,
    workingWindows: [{ start: '09:00', end: '13:00' }],
    durationMin: 60,
    slotStepMin: 30,
    now: T('00:00'),
  }
  const busy = (s: string, e: string): Interval => ({ start: T(s), end: T(e) })
  const hhmm = (d: Date) => d.toISOString().slice(11, 16)

  it('kant-mot-kant erbjuds: en upptagen 10:00-11:00 hindrar inte start 11:00', () => {
    const slots = computeSlots({ ...base, busy: [busy('10:00', '11:00')] }).map(hhmm)
    expect(slots).toContain('11:00')
    expect(slots).toContain('09:00') // slutar 10:00, kant-mot-kant åt andra hållet
    expect(slots).not.toContain('10:00')
    expect(slots).not.toContain('10:30')
  })

  it('varje erbjuden tid är krockfri enligt DB-constrainten (korsvalidering)', () => {
    const upptagna = [busy('10:00', '11:00'), busy('12:00', '12:30')]
    const slots = computeSlots({ ...base, busy: upptagna, slotStepMin: 15 })
    for (const s of slots) {
      const kandidat = row('00:00', '00:00')
      kandidat.start = s
      kandidat.end = new Date(s.getTime() + 60 * 60_000)
      for (const b of upptagna) {
        expect(dbConflicts(kandidat, { staffId: 'S1', start: b.start, end: b.end, status: 'confirmed' }))
          .toBe(false)
      }
    }
    expect(slots.length).toBeGreaterThan(0)
  })

  it('buffert döljer tiden i listan — men DB:n känner inte till bufferten', () => {
    // Med 15 min buffert reserverar en 60-minuterstid [t, t+75). 11:00 döljs
    // eftersom [11:00,12:15) krockar med 12:00-12:30.
    const upptagen = busy('12:00', '12:30')
    const slots = computeSlots({ ...base, busy: [upptagen], bufferMin: 15 }).map(hhmm)
    expect(slots).not.toContain('11:00')

    // Men constrainten ser BARA start_ts/end_ts: [11:00,12:00) krockar inte med
    // [12:00,12:30). Bufferten är alltså en PRESENTATIONSregel, inte ett skydd —
    // en direkt RPC/admin-skrivning kan lägga bokningen där ändå.
    const kandidat = row('11:00', '12:00')
    expect(dbConflicts(kandidat, { staffId: 'S1', start: upptagen.start, end: upptagen.end, status: 'confirmed' }))
      .toBe(false)
  })

  it('avbokad tid frigörs: busy-listan innehåller inte cancelled → tiden erbjuds igen', () => {
    // get_busy_intervals filtrerar på aktiva statusar; efter en avbokning
    // försvinner intervallet ur busy och 10:00 dyker upp igen.
    const före = computeSlots({ ...base, busy: [busy('10:00', '11:00')] }).map(hhmm)
    const efter = computeSlots({ ...base, busy: [] }).map(hhmm)
    expect(före).not.toContain('10:00')
    expect(efter).toContain('10:00')
  })
})
