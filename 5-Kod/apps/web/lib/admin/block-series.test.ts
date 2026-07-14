import { describe, it, expect } from 'vitest'
import { seriesOccurrences } from './block-series'

const TZ = 'Europe/Stockholm'

// 12:00 svensk sommartid = 10:00 UTC.
const START = '2026-07-20T10:00:00.000Z' // måndag 20 juli 2026, 12:00 lokal
const END = '2026-07-20T10:45:00.000Z' // 45 min

function localTime(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

describe('seriesOccurrences', () => {
  it("'ingen' ger exakt blocket självt", () => {
    const occ = seriesOccurrences({ startIso: START, endIso: END, repeat: 'ingen', tz: TZ })
    expect(occ).toEqual([{ startIso: START, endIso: END }])
  })

  it('varje dag håller 12:00 PÅ VÄGGKLOCKAN över höstens DST-skifte', () => {
    // Det här är seriens hela existensberättigande. Sverige lämnar sommartid
    // 2026-10-25. En serie byggd med +24h-i-millisekunder hade glidit till 11:00
    // efter skiftet; en väggklockeserie ligger kvar på 12:00.
    const occ = seriesOccurrences({ startIso: START, endIso: END, repeat: 'dag', tz: TZ })
    for (const o of occ) expect(localTime(o.startIso)).toBe('12:00')

    // Och UTC-instanten SKA hoppa vid skiftet — annars är det ingen väggklocka.
    const beforeShift = occ.find((o) => o.startIso.startsWith('2026-10-24'))!
    const afterShift = occ.find((o) => o.startIso.startsWith('2026-10-26'))!
    expect(beforeShift.startIso).toContain('T10:00')
    expect(afterShift.startIso).toContain('T11:00')
  })

  it('längden är en varaktighet — 45 min även tvärs DST', () => {
    const occ = seriesOccurrences({ startIso: START, endIso: END, repeat: 'dag', tz: TZ })
    for (const o of occ) {
      expect(new Date(o.endIso).getTime() - new Date(o.startIso).getTime()).toBe(45 * 60_000)
    }
  })

  it('vardagar hoppar helger men behåller alltid första förekomsten', () => {
    // Serien ankras på en LÖRDAG — användarens uttryckliga val står kvar,
    // upprepningen lägger sig på vardagarna.
    const satStart = '2026-07-25T10:00:00.000Z' // lördag
    const occ = seriesOccurrences({
      startIso: satStart,
      endIso: '2026-07-25T10:30:00.000Z',
      repeat: 'vardagar',
      tz: TZ,
    })
    expect(occ[0]!.startIso).toBe(satStart)
    for (const o of occ.slice(1)) {
      const dow = new Date(o.startIso).getUTCDay()
      expect(dow).toBeGreaterThanOrEqual(1)
      expect(dow).toBeLessThanOrEqual(5)
    }
  })

  it('varje vecka landar på samma veckodag, ~53 förekomster på ett år', () => {
    const occ = seriesOccurrences({ startIso: START, endIso: END, repeat: 'vecka', tz: TZ })
    expect(occ.length).toBeGreaterThanOrEqual(52)
    expect(occ.length).toBeLessThanOrEqual(54)
    for (const o of occ) expect(new Date(o.startIso).getUTCDay()).toBe(1) // måndag
  })

  it('varannan vecka ger hälften så många', () => {
    const weekly = seriesOccurrences({ startIso: START, endIso: END, repeat: 'vecka', tz: TZ })
    const biweekly = seriesOccurrences({
      startIso: START,
      endIso: END,
      repeat: 'varannan',
      tz: TZ,
    })
    expect(Math.abs(weekly.length - biweekly.length * 2)).toBeLessThanOrEqual(1)
  })

  it('årligen ger tre förekomster (denna + två år)', () => {
    const occ = seriesOccurrences({ startIso: START, endIso: END, repeat: 'ar', tz: TZ })
    expect(occ.map((o) => o.startIso.slice(0, 4))).toEqual(['2026', '2027', '2028'])
    for (const o of occ) expect(localTime(o.startIso)).toBe('12:00')
  })

  it('materialiseringen är begränsad — aldrig fler än ~366 rader', () => {
    const occ = seriesOccurrences({ startIso: START, endIso: END, repeat: 'dag', tz: TZ })
    expect(occ.length).toBeLessThanOrEqual(366)
  })
})
