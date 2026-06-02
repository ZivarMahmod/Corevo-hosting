import { describe, it, expect } from 'vitest'
import { filterHeldSlots, activeHolds, type Hold } from './holds'

const MIN = 60_000
function at(iso: string): Date {
  return new Date(iso)
}
/** reservedEnd helper: slot + durationMin (no buffer) for these tests. */
function plus(durationMin: number) {
  return (s: Date) => new Date(s.getTime() + durationMin * MIN)
}

describe('filterHeldSlots (dormant 5-min hold, M3 §2.2)', () => {
  const slots = [
    at('2026-06-01T09:00:00.000Z'),
    at('2026-06-01T09:30:00.000Z'),
    at('2026-06-01T10:00:00.000Z'),
  ]

  it('no holds → returns slots unchanged (identity, inert default)', () => {
    expect(filterHeldSlots(slots, [], plus(30))).toEqual(slots)
  })

  it('drops a slot whose reserved interval overlaps a hold', () => {
    const holds: Hold[] = [{ start: at('2026-06-01T09:20:00.000Z'), end: at('2026-06-01T09:40:00.000Z') }]
    const out = filterHeldSlots(slots, holds, plus(30))
    // 09:00–09:30 ends exactly at 09:30 (touches hold start? hold is 09:20–09:40)
    // → 09:00–09:30 overlaps 09:20–09:40, dropped. 09:30–10:00 overlaps too. 10:00 ok.
    expect(out).toEqual([at('2026-06-01T10:00:00.000Z')])
  })

  it('touching edges do NOT collide (back-to-back allowed)', () => {
    const holds: Hold[] = [{ start: at('2026-06-01T09:30:00.000Z'), end: at('2026-06-01T10:00:00.000Z') }]
    const out = filterHeldSlots(slots, holds, plus(30)).map((d) => d.toISOString())
    // 09:00–09:30 touches the hold start at 09:30 → allowed.
    expect(out).toContain('2026-06-01T09:00:00.000Z')
    // 09:30–10:00 IS the hold window → dropped. 10:00 touches hold end → allowed.
    expect(out).not.toContain('2026-06-01T09:30:00.000Z')
    expect(out).toContain('2026-06-01T10:00:00.000Z')
  })

  it('buffer is honoured via reservedEnd (longer reserved interval collides more)', () => {
    const holds: Hold[] = [{ start: at('2026-06-01T09:40:00.000Z'), end: at('2026-06-01T09:50:00.000Z') }]
    // duration 30 → 09:30–10:00 reserved overlaps 09:40–09:50; with +0 buffer 09:00–09:30 is clear.
    const out = filterHeldSlots(slots, holds, plus(30)).map((d) => d.toISOString())
    expect(out).toContain('2026-06-01T09:00:00.000Z')
    expect(out).not.toContain('2026-06-01T09:30:00.000Z')
  })
})

describe('activeHolds (clock gate)', () => {
  const now = at('2026-06-01T12:00:00.000Z')
  it('keeps holds expiring strictly after now, drops the rest', () => {
    const holds = [
      { id: 'live', expiresAt: at('2026-06-01T12:04:00.000Z') },
      { id: 'edge', expiresAt: now }, // == now → expired
      { id: 'stale', expiresAt: at('2026-06-01T11:59:00.000Z') },
    ]
    expect(activeHolds(holds, now).map((h) => h.id)).toEqual(['live'])
  })
})
