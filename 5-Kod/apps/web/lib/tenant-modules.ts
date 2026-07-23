// Tenant MODULE-state layer (multi-bransch spår 5) — reads a tenant's per-module
// lifecycle (`tenant_modules.state`) so the storefront renders only what is LIVE.
//
// Contract (1-Planering/05-multibransch-bygge/00-plan-index.md):
//   off    → module never activated (super-admin only flips off→draft)
//   draft  → activated but NOT public yet → invisible on the storefront
//   live   → public → render it
//   paused → temporarily closed → render a "stängt"-banner (booking)
//
// BACKWARD COMPATIBILITY (the FreshCut guarantee): a tenant with NO tenant_modules
// row for a module falls back to the historical default `booking:live`. Every tenant
// that existed before this layer either was backfilled to booking:live (migration
// 0028) OR — if the read ever races/fails — still renders booking, so the public
// storefront never regresses. Only an EXPLICIT non-live row hides/pauses booking.
//
// CRITICAL (same fence as tenant-data.ts): the `anon` role carries no tenant_id
// claim, so RLS does not isolate tenants for the public client — every query here
// filters by the resolved tenant_id in the app. RLS is defense-in-depth only.
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'

/** The four lifecycle states a module can hold per tenant (tenant_modules.state). */
export const MODULE_STATES = ['off', 'draft', 'live', 'paused'] as const
export type ModuleState = (typeof MODULE_STATES)[number]

/** A module key is just a string in the DB (modules.key); we keep the well-known
 *  ones as a union for ergonomics but tolerate any string the catalog adds later. */
export type ModuleKey = 'booking' | 'media_library' | (string & {})

/** Map of module_key → its state for one tenant. Modules with no row are ABSENT
 *  from the map; consumers must apply the per-module default (see moduleState). */
export type TenantModuleStates = Record<string, ModuleState>

/** The historical baseline: before tenant_modules existed every tenant ran booking.
 *  A missing booking row therefore means "live" (never hide an un-migrated salon).
 *  Any other module defaults to 'off' (opt-in) when it has no row. */
const DEFAULT_MODULE_STATE: Record<string, ModuleState> = { booking: 'live' }

function parseState(raw: unknown): ModuleState | null {
  return (MODULE_STATES as readonly string[]).includes(raw as string) ? (raw as ModuleState) : null
}

/**
 * Resolve a single module's state from a states map, applying the per-module
 * default when the tenant has no explicit row. This is the ONE place the
 * backward-compat default lives so the storefront and any future caller agree.
 */
export function moduleState(states: TenantModuleStates, key: ModuleKey): ModuleState {
  return states[key] ?? DEFAULT_MODULE_STATE[key] ?? 'off'
}

/** True when the module should render publicly (storefront shows live only). */
export function isModuleLive(states: TenantModuleStates, key: ModuleKey): boolean {
  return moduleState(states, key) === 'live'
}

/** True when the module is activated but temporarily closed (booking → "stängt"). */
export function isModulePaused(states: TenantModuleStates, key: ModuleKey): boolean {
  return moduleState(states, key) === 'paused'
}

/**
 * Load a tenant's module states by tenant id. Cached per-tenant and tagged with the
 * SAME `tenant:<slug>` tag getTenantBySlug uses, so a platform module-toggle that
 * busts that tag refreshes the storefront's module gating too. Read via the anon
 * public client; scoped by tenant_id app-side (RLS does NOT isolate anon).
 *
 * The narrow RPC is required because the table's anon policy intentionally hides
 * off/draft rows. Direct table reads would therefore mistake an explicit
 * website-only booking=off for a missing legacy row and incorrectly enable booking.
 * Returns an empty map on any error — callers then keep the legacy booking default.
 */
export async function getTenantModuleStates(
  tenantId: string,
  slug: string,
): Promise<TenantModuleStates> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<TenantModuleStates> => {
      type PublicModuleStateRpc = {
        rpc: (
          name: 'get_public_tenant_module_states',
          args: { p_tenant: string },
        ) => PromiseLike<{
          data: { module_key: string; state: string }[] | null
          error: { message: string } | null
        }>
      }
      const supabase = createPublicClient() as unknown as PublicModuleStateRpc
      const { data, error } = await supabase
        .rpc('get_public_tenant_module_states', { p_tenant: tenantId })
      if (error || !data) return {}
      const out: TenantModuleStates = {}
      for (const row of data) {
        const st = parseState(row.state)
        if (st) out[row.module_key] = st
      }
      return out
    },
    ['tenant-modules-by-tenant', tenantId],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
