// ── DATA-GATED fields (goal-17 truth report: verdict 'absent') ───────────────
// The Frisör recognition strip (M5 §2.2) shows "Brukar komma: var X:e vecka" and
// "Bjuds på: [drink]". NEITHER has a backing column anywhere in the schema
// (verified against packages/db/types.ts + migrations 0001–0022; not in
// customer_notes.preferences/allergies/products either). The mock values are
// PLACEHOLDERS, not data. Per goal-17 LAW (⛔ NEVER FAKE DATA) and the truth
// report, we expose TYPED empty values so the per-page build renders an honest
// written empty-state ("—") — we never invent a column, never derive (the truth
// report does NOT list cadence/drink as derive targets; computing cadence from
// booking-deltas would be a guess / scope creep), never hardcode a sample.
//
// Signatures mirror the proposed contracts — async (customerId, tenantId) — for
// forward-compat: when a future migration adds these fields, the bodies become
// real authed reads and EVERY consumer keeps compiling unchanged. The args are
// intentionally unused today (there is nothing to read).

export type CustomerCadence = { cadenceWeeks: null }
export type CustomerBeverage = { drink: null }

/**
 * Customer visit cadence ("Brukar komma: var X:e vecka"). Always
 * { cadenceWeeks: null } → the strip shows an honest empty label. Args reserved
 * for the future real read.
 */
export async function getCustomerCadenceHint(
  _customerId: string,
  _tenantId: string,
): Promise<CustomerCadence> {
  return { cadenceWeeks: null }
}

/**
 * Customer beverage preference ("Bjuds på: [drink]"). Always { drink: null } →
 * the strip shows an honest empty label. Args reserved for the future real read.
 */
export async function getCustomerBeveragePreference(
  _customerId: string,
  _tenantId: string,
): Promise<CustomerBeverage> {
  return { drink: null }
}
