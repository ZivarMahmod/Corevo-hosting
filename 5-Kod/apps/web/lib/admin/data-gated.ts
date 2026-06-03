// ── DATA-GATED field (goal-17 truth report: verdict 'absent') ────────────────
// The Tjänster "Populär" gold badge has NO backing column anywhere in the schema
// (verified against packages/db/types.ts services Row + migrations 0001–0022).
// The mock shows a sample badge but that is a PLACEHOLDER, not data. Per goal-17
// LAW (⛔ NEVER FAKE DATA) and the truth report, we expose a TYPED empty value so
// the per-page build renders an honest written empty-state (no badge) — we never
// invent a column, never derive (deriving from booking frequency is NOT in the
// truth report's derive-list → scope creep), never hardcode a sample.
//
// Signature mirrors the proposed contract — async (serviceId, tenantId) — for
// forward-compat: when a future migration adds a `popular` column, the body
// becomes a real authed read and EVERY consumer keeps compiling unchanged. The
// args are intentionally unused today (there is nothing to read).

export type ServicePopularity = { popular: false }

/**
 * Service "Populär" badge state (Tjänster §4.4). Always { popular: false } until
 * the feature is modeled. Args reserved for the future real read.
 */
export async function getServicePopularityTag(
  _serviceId: string,
  _tenantId: string,
): Promise<ServicePopularity> {
  return { popular: false }
}
