// 5-min slot-hold filtering — DORMANT (M3 §2.2). Pure + dependency-free, exactly
// like computeSlots: no DB access, no Supabase client, no frozen `packages/db`
// types. This keeps it typecheck-safe while migration 0014 (slot_holds) is READY
// but NOT applied — nothing in the live booking path imports this yet.
//
// WHEN 0014 IS APPLIED + types regenerated: getAvailableSlots reads the tenant's
// ACTIVE holds (slot_holds where expires_at > now(), EXCLUDING the caller's own
// session) for the candidate staff, maps them to {start,end} instants, and runs
// the offered slots through filterHeldSlots() before returning — so a tid another
// visitor is mid-booking disappears for 5 minutes, then auto-reappears on expiry.
// Until then this module is inert: importing it changes no behaviour.

export type Hold = { start: Date; end: Date }

/**
 * Remove offered start instants that collide with an active hold by ANOTHER
 * session. `slots` are candidate UTC starts for ONE staff member; `reservedEnd`
 * is the instant each slot would occupy through (start + duration + buffer) — the
 * same reserved interval computeSlots checks against busy intervals, so a hold is
 * treated identically to a tentative booking.
 *
 * A hold blocks a slot when [start, reservedEnd) overlaps [hold.start, hold.end).
 * Touching edges do NOT collide (back-to-back allowed), mirroring computeSlots.
 * Expired holds must be filtered out by the caller (pass only active holds) — this
 * function is pure and has no clock.
 */
export function filterHeldSlots(
  slots: Date[],
  holds: Hold[],
  reservedEnd: (slotStart: Date) => Date,
): Date[] {
  if (holds.length === 0) return slots
  const holdMs = holds.map((h) => ({ start: h.start.getTime(), end: h.end.getTime() }))
  return slots.filter((s) => {
    const startMs = s.getTime()
    const endMs = reservedEnd(s).getTime()
    // half-open overlap: aStart < bEnd && bStart < aEnd
    return !holdMs.some((h) => startMs < h.end && h.start < endMs)
  })
}

/** Drop holds whose expiry is at/before `now` — the caller's clock gate so
 *  filterHeldSlots can stay pure. Active = expires_at strictly after now. */
export function activeHolds<T extends { expiresAt: Date }>(holds: T[], now: Date): T[] {
  const nowMs = now.getTime()
  return holds.filter((h) => h.expiresAt.getTime() > nowMs)
}
