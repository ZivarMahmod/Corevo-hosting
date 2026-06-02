import { describe, it, expect } from 'vitest'
import { computeSlots, type Interval } from './availability'
import { zonedTimeToUtc } from './tz'

const TZ = 'Europe/Stockholm'
const DAY = '2026-06-01' // Monday, summer (CEST = UTC+2)

/** Local wall-clock 'HH:MM' on the test day → UTC ISO string. */
function iso(hhmm: string, day = DAY): string {
  return zonedTimeToUtc(day, hhmm, TZ).toISOString()
}
/** Local wall-clock interval helper. */
function busy(startHHMM: string, endHHMM: string, day = DAY): Interval {
  return { start: zonedTimeToUtc(day, startHHMM, TZ), end: zonedTimeToUtc(day, endHHMM, TZ) }
}
function isoList(slots: Date[]): string[] {
  return slots.map((d) => d.toISOString())
}

describe('computeSlots', () => {
  it('fills an open window at the slot step (no busy)', () => {
    const slots = computeSlots({
      date: DAY,
      timeZone: TZ,
      workingWindows: [{ start: '09:00', end: '12:00' }],
      busy: [],
      durationMin: 30,
      slotStepMin: 15,
    })
    expect(slots).toHaveLength(11) // 09:00 … 11:30 inclusive
    expect(isoList(slots)[0]).toBe(iso('09:00'))
    expect(isoList(slots).at(-1)).toBe(iso('11:30'))
    // sorted ascending
    expect(isoList(slots)).toEqual([...isoList(slots)].sort())
  })

  it('removes slots that overlap an existing booking (touching edges allowed)', () => {
    const slots = isoList(
      computeSlots({
        date: DAY,
        timeZone: TZ,
        workingWindows: [{ start: '09:00', end: '12:00' }],
        busy: [busy('10:00', '10:30')],
        durationMin: 30,
        slotStepMin: 15,
      }),
    )
    expect(slots).not.toContain(iso('09:45')) // 09:45–10:15 overlaps
    expect(slots).not.toContain(iso('10:00')) // 10:00–10:30 overlaps
    expect(slots).not.toContain(iso('10:15')) // 10:15–10:45 overlaps
    expect(slots).toContain(iso('09:30')) // 09:30–10:00 touches, ok
    expect(slots).toContain(iso('10:30')) // 10:30–11:00 touches, ok
  })

  it('treats time off the same as a booking', () => {
    const slots = isoList(
      computeSlots({
        date: DAY,
        timeZone: TZ,
        workingWindows: [{ start: '09:00', end: '12:00' }],
        busy: [busy('09:00', '09:30')], // time off
        durationMin: 30,
        slotStepMin: 15,
      }),
    )
    expect(slots).not.toContain(iso('09:00'))
    expect(slots[0]).toBe(iso('09:30'))
  })

  it('respects the working-hours upper bound for the service duration', () => {
    const slots = isoList(
      computeSlots({
        date: DAY,
        timeZone: TZ,
        workingWindows: [{ start: '09:00', end: '12:00' }],
        busy: [],
        durationMin: 45,
        slotStepMin: 15,
      }),
    )
    expect(slots.at(-1)).toBe(iso('11:15')) // 11:15–12:00 fits exactly
    expect(slots).not.toContain(iso('11:30')) // 11:30–12:15 exceeds close
  })

  it('a slot that fits the window exactly is included', () => {
    const slots = isoList(
      computeSlots({
        date: DAY,
        timeZone: TZ,
        workingWindows: [{ start: '09:00', end: '09:30' }],
        busy: [],
        durationMin: 30,
        slotStepMin: 15,
      }),
    )
    expect(slots).toEqual([iso('09:00')])
  })

  it('applies a buffer AFTER the appointment when checking conflicts', () => {
    const base = {
      date: DAY,
      timeZone: TZ,
      workingWindows: [{ start: '09:00', end: '12:00' }],
      busy: [busy('10:00', '10:30')],
      durationMin: 30,
      slotStepMin: 15,
    }
    const noBuffer = isoList(computeSlots({ ...base, bufferMin: 0 }))
    const withBuffer = isoList(computeSlots({ ...base, bufferMin: 15 }))
    expect(noBuffer).toContain(iso('09:30')) // 09:30–10:00 ok without buffer
    expect(withBuffer).not.toContain(iso('09:30')) // +15 buffer → 09:30–10:15 overlaps
    expect(withBuffer).toContain(iso('09:15')) // 09:15–10:00 (+buffer to 10:00) just fits
  })

  it('drops slots in the past relative to `now`', () => {
    const slots = isoList(
      computeSlots({
        date: DAY,
        timeZone: TZ,
        workingWindows: [{ start: '09:00', end: '12:00' }],
        busy: [],
        durationMin: 30,
        slotStepMin: 15,
        now: zonedTimeToUtc(DAY, '10:00', TZ),
      }),
    )
    expect(slots).not.toContain(iso('09:45'))
    expect(slots[0]).toBe(iso('10:00'))
  })

  it('handles split working windows and returns a sorted union', () => {
    const slots = isoList(
      computeSlots({
        date: DAY,
        timeZone: TZ,
        workingWindows: [
          { start: '09:00', end: '10:00' },
          { start: '13:00', end: '14:00' },
        ],
        busy: [],
        durationMin: 30,
        slotStepMin: 30,
      }),
    )
    expect(slots).toEqual([iso('09:00'), iso('09:30'), iso('13:00'), iso('13:30')])
  })

  it('is correct on the DST fall-back day (UTC offset shifts to +1)', () => {
    const dstDay = '2026-10-25'
    const slots = isoList(
      computeSlots({
        date: dstDay,
        timeZone: TZ,
        workingWindows: [{ start: '09:00', end: '10:00' }],
        busy: [],
        durationMin: 30,
        slotStepMin: 30,
      }),
    )
    expect(slots).toEqual([
      '2026-10-25T08:00:00.000Z', // 09:00 CET (+1)
      '2026-10-25T08:30:00.000Z',
    ])
  })

  it('returns no slots when there are no working windows', () => {
    expect(
      computeSlots({
        date: DAY,
        timeZone: TZ,
        workingWindows: [],
        busy: [],
        durationMin: 30,
      }),
    ).toEqual([])
  })
})

// ── M3 Våg 3 read-wiring (3a + 3b) ──────────────────────────────────────────
// Explicit-slots (working_hour_slots, migr 0011) are OPT-IN. The live default is
// ZERO rows → the range raster runs. These tests pin that an overnight regression
// can never silently empty range-staff availability, and that the explicit path +
// per-service/staff step overrides behave to spec.
describe('computeSlots — explicit working_hour_slots (3b, OPT-IN) + step override (3a)', () => {
  const baseRange = {
    date: DAY,
    timeZone: TZ,
    workingWindows: [{ start: '09:00', end: '12:00' }],
    busy: [] as Interval[],
    durationMin: 30,
    slotStepMin: 15,
  }

  it('(1) staff WITHOUT explicit slots → range path yields the SAME slots as today', () => {
    // The exact range output, snapshotted from the existing stepped behaviour.
    const expected = isoList(computeSlots(baseRange))
    expect(expected).toEqual([
      iso('09:00'), iso('09:15'), iso('09:30'), iso('09:45'),
      iso('10:00'), iso('10:15'), iso('10:30'), iso('10:45'),
      iso('11:00'), iso('11:15'), iso('11:30'),
    ])
    // undefined explicitStarts → identical
    expect(isoList(computeSlots({ ...baseRange, explicitStarts: undefined }))).toEqual(expected)
    // empty explicitStarts → still the range path (empty is NOT "use explicit")
    expect(isoList(computeSlots({ ...baseRange, explicitStarts: [] }))).toEqual(expected)
  })

  it('(2) staff WITH explicit slots → ONLY those starts are offered (not the raster)', () => {
    const slots = isoList(
      computeSlots({
        ...baseRange,
        // Explicit list is irregular and NOT on the 15-min grid → proves the raster
        // is bypassed (the list IS the step, 0011:183).
        explicitStarts: ['09:00', '09:40', '11:20'],
      }),
    )
    expect(slots).toEqual([iso('09:00'), iso('09:40'), iso('11:20')])
    // A raster-only time like 09:15 must NOT appear in explicit mode.
    expect(slots).not.toContain(iso('09:15'))
  })

  it('(2b) explicit slots still respect busy/buffer/window-fit/now', () => {
    const slots = isoList(
      computeSlots({
        ...baseRange,
        busy: [busy('09:30', '10:00')],
        explicitStarts: [
          '08:30', // before window → dropped
          '09:00', // ok
          '09:30', // overlaps busy → dropped
          '11:45', // 11:45–12:15 exceeds 12:00 close → dropped
        ],
      }),
    )
    expect(slots).toEqual([iso('09:00')])
  })

  it('(2c) explicit slots ignore slotStepMin entirely', () => {
    // A coarse step would normally drop 09:40/11:20; explicit mode keeps them.
    const slots = isoList(
      computeSlots({
        ...baseRange,
        slotStepMin: 60,
        explicitStarts: ['09:40', '11:20'],
      }),
    )
    expect(slots).toEqual([iso('09:40'), iso('11:20')])
  })

  it('(3) slot_step_min override applies; NULL → default 15 (range path)', () => {
    // A 30-min override halves the offered starts vs the 15-min default.
    const step30 = isoList(computeSlots({ ...baseRange, slotStepMin: 30 }))
    expect(step30).toEqual([
      iso('09:00'), iso('09:30'), iso('10:00'), iso('10:30'), iso('11:00'), iso('11:30'),
    ])
    // The call site resolves service ?? staff ?? 15. When both DB values are NULL
    // the resolver passes 15 — mirrored here by the default param (slotStepMin
    // omitted → 15), which must equal the explicit-15 baseline.
    const { slotStepMin: _omit, ...noStep } = baseRange
    void _omit
    expect(isoList(computeSlots(noStep))).toEqual(isoList(computeSlots(baseRange)))
  })

  it('(3b) buffer override applies in the range path against busy (service ?? staff ?? 0)', () => {
    // bufferMin omitted → 0 (today). The buffer guards the gap AFTER the slot vs
    // BUSY intervals (not the bare window bound — see the existing buffer test).
    // A booking at 10:00–10:30 leaves 09:30 free with no buffer, but a 15-min
    // buffer pushes the 09:30 slot's reserved end to 10:15 → it now overlaps.
    const withBusy = { ...baseRange, busy: [busy('10:00', '10:30')] }
    const noBuffer = isoList(computeSlots({ ...withBusy, bufferMin: 0 }))
    const buffered = isoList(computeSlots({ ...withBusy, bufferMin: 15 }))
    expect(noBuffer).toContain(iso('09:30')) // 09:30–10:00 touches, ok with no buffer
    expect(buffered).not.toContain(iso('09:30')) // +15 buffer → reserved to 10:15 overlaps
    expect(buffered).toContain(iso('09:15')) // 09:15–10:00 (+buffer to 10:00) just fits
  })
})
