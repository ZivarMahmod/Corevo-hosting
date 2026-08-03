// Tenant module visibility. There is one truth everywhere:
// off = disabled and hidden, live = enabled and public.
//
// CRITICAL (same fence as tenant-data.ts): the `anon` role carries no tenant_id
// claim, so RLS does not isolate tenants for the public client — every query here
// filters by the resolved tenant_id in the app. RLS is defense-in-depth only.
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'

export const MODULE_STATES = ['off', 'live'] as const
export type ModuleState = (typeof MODULE_STATES)[number]

/** A module key is just a string in the DB (modules.key); we keep the well-known
 *  ones as a union for ergonomics but tolerate any string the catalog adds later. */
export type ModuleKey = 'booking' | 'media_library' | (string & {})

/** Map of module_key → its state for one tenant. Missing rows are off. */
export type TenantModuleStates = Record<string, ModuleState>

function parseState(raw: unknown): ModuleState | null {
  return (MODULE_STATES as readonly string[]).includes(raw as string) ? (raw as ModuleState) : null
}

/**
 * Resolve a single module's state. No row means off.
 */
export function moduleState(states: TenantModuleStates, key: ModuleKey): ModuleState {
  return states[key] ?? 'off'
}

/** True when the module should render publicly (storefront shows live only). */
export function isModuleLive(states: TenantModuleStates, key: ModuleKey): boolean {
  return moduleState(states, key) === 'live'
}

export function isModulePublicReadable(
  states: TenantModuleStates,
  key: ModuleKey,
): boolean {
  return isModuleLive(states, key)
}

export function isModuleAdminWritable(
  states: TenantModuleStates,
  key: ModuleKey,
): boolean {
  return isModuleLive(states, key)
}

/** Friendly app mirror of the DB-owned lifecycle; the DB guard remains authoritative. */
export function canTransitionModuleState(
  from: ModuleState,
  to: ModuleState,
  platformOperator: boolean,
): boolean {
  if (from === to) return true
  return platformOperator
}

/**
 * Load a tenant's module states by tenant id. Cached per-tenant and tagged with the
 * SAME `tenant:<slug>` tag getTenantBySlug uses, so a platform module-toggle that
 * busts that tag refreshes the storefront's module gating too. Read via the anon
 * public client; scoped by tenant_id app-side (RLS does NOT isolate anon).
 *
 * The narrow RPC is required because the table's anon policy intentionally hides
 * off rows. Missing rows mean off; read failures remain errors so they cannot be
 * mistaken for a valid module decision.
 */
export async function getTenantModuleStates(
  tenantId: string,
  slug: string,
): Promise<TenantModuleStates> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<TenantModuleStates> => {
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .rpc('get_public_tenant_module_states', { p_tenant: tenantId })
      if (error || !data) throw new Error('tenant_module_state_read_failed')
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
