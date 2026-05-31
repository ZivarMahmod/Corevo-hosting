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
