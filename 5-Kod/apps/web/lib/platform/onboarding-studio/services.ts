// Onboarding-studio (goal-48) W4 — services input parse/sanitize. PURE (no 'use
// server', no DB) so it is the one testable money-path seam between the studio's cfg
// and the services insert in createTenant. Two halves:
//   • krToOre        — UI kr string → integer öre (what the operator types → storage).
//   • parseServiceInputs — the emitted FormData JSON → clean {name, price_cents} rows.
//
// Storage truth (W0, verified vs migrations): price is INLINE `services.price_cents`
// (öre) — there is NO service_prices table (the 2026-06-16 design SpecStrip lied).
// `services.duration_min` is NOT NULL check>0 but the design collects no duration, so
// createTenant supplies a constant default; that is server-side, not here.

export type ServiceInput = { name: string; price_cents: number }

const MAX_SERVICES = 50
const MAX_NAME = 120
// 100 000 kr ceiling — rejects fat-finger / overflow without constraining real prices.
const MAX_PRICE_CENTS = 100_000_00

/**
 * UI kronor string → integer öre. Accepts Swedish comma OR dot decimals ("350",
 * "12,50", "12.5"). Junk / negative / non-finite → 0 (never throws, never negative).
 * Rounds to the nearest öre and caps at the sane ceiling.
 */
export function krToOre(price: string): number {
  const n = parseFloat(String(price).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(Math.round(n * 100), MAX_PRICE_CENTS)
}

/**
 * Parse the studio's `services` FormData field (a JSON array of {name, price_cents})
 * into clean rows for the insert. Fail-soft: bad JSON / non-array / junk items drop,
 * never throw. Money guard: price_cents must be finite ≥ 0; NaN/negative → 0, over-
 * ceiling → capped, fractional → rounded. Names trimmed + length-capped; empty names
 * dropped. Row count capped so a hostile payload can't fan out the insert.
 */
export function parseServiceInputs(raw: unknown): ServiceInput[] {
  if (typeof raw !== 'string' || raw === '') return []
  let arr: unknown
  try {
    arr = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []
  const out: ServiceInput[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const name = String(rec.name ?? '').trim().slice(0, MAX_NAME)
    if (!name) continue
    const n = typeof rec.price_cents === 'number' ? rec.price_cents : Number(rec.price_cents)
    const price_cents = Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), MAX_PRICE_CENTS) : 0
    out.push({ name, price_cents })
    if (out.length >= MAX_SERVICES) break
  }
  return out
}
