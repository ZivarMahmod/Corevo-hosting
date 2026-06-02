// Pure, testable slot computation for the booking engine.
// Given a staff member's working window(s) for a day + their busy intervals
// (existing bookings + time off), return the bookable start times for a service
// of a given duration. All instants are UTC; wall-clock working hours are
// converted via ./tz. No DB access here — the server action fetches the data
// and feeds it in, which keeps this unit-testable.

import { zonedTimeToUtc } from './tz'

export type Interval = { start: Date; end: Date }

/** A wall-clock opening window in the location's timezone, e.g. 09:00–17:00. */
export type WorkingWindow = { start: string; end: string }

export type ComputeSlotsInput = {
  /** The day being booked, 'YYYY-MM-DD', interpreted in `timeZone`. */
  date: string
  /** IANA timezone of the location (e.g. 'Europe/Stockholm'). */
  timeZone: string
  /** Opening window(s) for this staff member on this weekday. */
  workingWindows: WorkingWindow[]
  /** Existing bookings + time off (UTC instants) that block slots. */
  busy: Interval[]
  /** Service duration in minutes. */
  durationMin: number
  /** Required free gap AFTER the appointment (minutes). Default 0. */
  bufferMin?: number
  /** Granularity of offered start times (minutes). Default 15. */
  slotStepMin?: number
  /**
   * OPT-IN explicit start times (wall-clock 'HH:MM' / 'HH:MM:SS' in `timeZone`),
   * from `working_hour_slots` (migration 0011). When non-empty, these REPLACE the
   * stepped raster: the engine offers exactly these starts (still bounded by the
   * working window, busy intervals, buffer and `now`) and `slotStepMin` is ignored
   * (the list IS the step — see 0011:183). When absent/empty, the stepped
   * `slotStepMin` path runs unchanged — so range-only staff (the live default,
   * zero rows) keep EXACTLY today's behaviour.
   */
  explicitStarts?: string[]
  /** If given, slots starting before this instant are dropped (no past slots). */
  now?: Date
}

const MIN = 60_000

/** Half-open overlap test: [aStart,aEnd) intersects [bStart,bEnd)? */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Compute bookable start instants (UTC) for one staff member on one day.
 *
 * A start `t` is offered when:
 *  - the appointment [t, t+duration) fits inside a working window, and
 *  - the reserved interval [t, t+duration+buffer) does not overlap any busy
 *    interval (existing bookings + time off), and
 *  - `t >= now` (when `now` is given).
 *
 * Touching edges do not count as overlap, so back-to-back bookings are allowed
 * (with bufferMin = 0).
 */
export function computeSlots(input: ComputeSlotsInput): Date[] {
  const { date, timeZone, workingWindows, busy, durationMin } = input
  const bufferMin = input.bufferMin ?? 0
  const stepMin = input.slotStepMin ?? 15
  const nowMs = input.now ? input.now.getTime() : -Infinity

  const durationMs = durationMin * MIN
  const reservedMs = (durationMin + bufferMin) * MIN
  const stepMs = stepMin * MIN
  const busyMs = busy.map((b) => ({ start: b.start.getTime(), end: b.end.getTime() }))

  // Explicit-slot mode (OPT-IN): when the staff member has explicit start times
  // for this day, the candidate starts are precisely those times — NOT the stepped
  // raster (so slotStepMin is intentionally unused here, per 0011:183). They are
  // still validated against the same window-fit, busy, buffer and `now` rules.
  // Empty/absent → fall through to the stepped raster below (the live default).
  const useExplicit = !!input.explicitStarts && input.explicitStarts.length > 0

  const starts: number[] = []
  for (const win of workingWindows) {
    const winStart = zonedTimeToUtc(date, win.start, timeZone).getTime()
    const winEnd = zonedTimeToUtc(date, win.end, timeZone).getTime()

    if (useExplicit) {
      for (const hhmm of input.explicitStarts!) {
        const t = zonedTimeToUtc(date, hhmm, timeZone).getTime()
        // The appointment must still fit inside this window. A start may belong to
        // a different window (split shifts) — it's accepted by whichever window it
        // fits; the union dedupe below collapses any cross-window repeats.
        if (t < winStart || t + durationMs > winEnd) continue
        if (t < nowMs) continue
        const reservedEnd = t + reservedMs
        const blocked = busyMs.some((b) => overlaps(t, reservedEnd, b.start, b.end))
        if (!blocked) starts.push(t)
      }
      continue
    }

    for (let t = winStart; t + durationMs <= winEnd; t += stepMs) {
      if (t < nowMs) continue
      const reservedEnd = t + reservedMs
      const blocked = busyMs.some((b) => overlaps(t, reservedEnd, b.start, b.end))
      if (!blocked) starts.push(t)
    }
  }

  // Union of windows → sort + dedupe (a slot can't legitimately repeat, but
  // overlapping windows in bad data shouldn't double-list).
  const unique = Array.from(new Set(starts)).sort((a, b) => a - b)
  return unique.map((ms) => new Date(ms))
}
