import 'server-only'
// Tenant MODULE-state WRITE layer (multi-bransch spår 5) — the create-path half:
// turns the wizard's chosen vertical + module states into `tenants.vertical_id`
// + `tenant_modules` rows, written with the authed PLATFORM client.
//
// Why this passes the DB state-guard (migration 0026 §9): off→draft (module
// activation) is super-admin only. createTenant runs under platformCtx → the authed
// client carries the platform_admin JWT claim (private.is_platform_admin()), so the
// guard admits a row inserted with state 'draft'/'live'/'paused'. A tenant-admin
// going through PostgREST without that claim would be blocked — exactly the contract.
//
// Atomicity: these writes happen INSIDE createTenant's cascade-rollback window
// (tenants is the parent; tenant_modules FKs it ON DELETE CASCADE). The caller calls
// rollback() (delete the tenant) on any failure, so a partial module write vanishes
// with the tenant — no orphaned rows.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'

type PlatformClient = SupabaseClient<Database>

/** A module the operator chose to provision at create-time, with its initial state. */
export type ModuleSelection = { moduleKey: string; state: ModuleState }

function isState(v: unknown): v is ModuleState {
  return typeof v === 'string' && (MODULE_STATES as readonly string[]).includes(v)
}

/**
 * Parse the wizard's `modules` form field — a JSON object { module_key: state } — into
 * a clean, deduped selection list. Tolerates a missing/garbage field (→ []), drops
 * unknown states, and trims keys. Normalisation applies the safe booking default
 * separately, so this stays a pure parser.
 */
export function parseModuleSelections(raw: FormDataEntryValue | null): ModuleSelection[] {
  const text = String(raw ?? '').trim()
  if (!text) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
  const out: ModuleSelection[] = []
  const seen = new Set<string>()
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const key = k.trim()
    if (!key || seen.has(key) || !isState(v)) continue
    seen.add(key)
    out.push({ moduleKey: key, state: v })
  }
  return out
}

/**
 * Missing booking keeps the platform's safe live default. Draft is not a valid
 * public booking state at create-time and is raised to live. An EXPLICIT off row
 * survives because it is the website-only contract; other off rows are still
 * dropped (absence == off on read).
 */
export function normalizeSelections(selections: ModuleSelection[]): ModuleSelection[] {
  const byKey = new Map<string, ModuleState>()
  for (const s of selections) byKey.set(s.moduleKey, s.state)
  const hasExplicitBooking = byKey.has('booking')
  const booking = byKey.get('booking')
  if (!hasExplicitBooking || booking === 'draft') byKey.set('booking', 'live')
  // Preserve booking=off; it distinguishes an intentional website-only tenant
  // from a missing row, which retains the historic Corevo-booking default.
  return [...byKey.entries()]
    .filter(([key, state]) => state !== 'off' || key === 'booking')
    .map(([moduleKey, state]) => ({ moduleKey, state }))
}

/**
 * Validate the chosen module keys against the real `modules` catalog (FK target).
 * Returns only the selections whose key exists, so a stale/typo'd key from the client
 * can never 23503 the whole insert. Returns [] when the catalog read fails (caller
 * then writes nothing — booking is re-added by normalizeSelections upstream anyway).
 */
async function filterToCatalog(
  supabase: PlatformClient,
  selections: ModuleSelection[],
): Promise<ModuleSelection[]> {
  if (selections.length === 0) return []
  const { data, error } = await supabase.from('modules').select('key')
  if (error || !data) return []
  const known = new Set(data.map((r) => r.key))
  return selections.filter((s) => known.has(s.moduleKey))
}

/**
 * Write a new tenant's vertical_id + tenant_modules rows. Call INSIDE createTenant
 * after the tenant row exists and BEFORE returning success, within the cascade-
 * rollback window. Returns { ok:false } on any DB error so the caller rolls back.
 *
 * Steps:
 *  1) tenants.vertical_id = verticalKey (when a bransch was chosen; null = skip).
 *  2) tenant_modules: one row per normalized, catalog-validated selection. Each is
 *     state-guard-admitted because the platform client carries platform_admin.
 *     activated_at is stamped by the DB guard when state leaves 'off'.
 */
export async function writeTenantVerticalAndModules(
  supabase: PlatformClient,
  tenantId: string,
  verticalKey: string | null,
  selections: ModuleSelection[],
): Promise<{ ok: true } | { ok: false }> {
  // 1) vertical_id (mjuk, mutabel). Only write when a bransch was actually picked —
  //    leaving it null is a valid "no bransch yet" state (matches the schema default).
  if (verticalKey) {
    const { error: vErr } = await supabase
      .from('tenants')
      .update({ vertical_id: verticalKey })
      .eq('id', tenantId)
    if (vErr) return { ok: false }
  }

  // 2) tenant_modules rows — normalize (safe booking default; explicit off kept) then
  //    fence to the catalog so no unknown key 23503s the insert.
  const normalized = normalizeSelections(selections)
  const valid = await filterToCatalog(supabase, normalized)
  if (valid.length === 0) return { ok: true } // nothing to write (shouldn't happen — booking is always present)

  const rows = valid.map((s) => ({
    tenant_id: tenantId,
    module_key: s.moduleKey,
    state: s.state,
    config: {},
  }))
  const { error: mErr } = await supabase.from('tenant_modules').insert(rows)
  if (mErr) return { ok: false }

  return { ok: true }
}
