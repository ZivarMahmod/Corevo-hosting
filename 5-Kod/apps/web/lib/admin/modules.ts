import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'

// Admin-side module-state layer (multi-bransch). Mirrors lib/tenant-modules.ts
// (which reads via the ANON public client for the storefront) but reads via the
// AUTHENTICATED server client so a logged-in salon admin sees their own tenant's
// module rows under RLS (tenant_modules_rls: tenant_id = private.tenant_id()).
//
// SCOPE: this layer is READ-ONLY. The per-tenant lifecycle state (off/draft/live/
// paused) is flipped by the SUPER-ADMIN only (locked principle: "bara Zivar gör
// off→draft", state-vakt in 0026 §9). The tenant admin uses these reads to (a)
// decide whether to show a module's admin surface and (b) display the current
// variant/config read-only. It NEVER writes tenant_modules.

export type AdminModuleRow = {
  state: ModuleState
  /** tenant_modules.config jsonb (variant + settings). Read-only for the admin. */
  config: Record<string, unknown>
}
export type AdminModuleStates = Record<string, AdminModuleRow>

function parseState(raw: unknown): ModuleState {
  return (MODULE_STATES as readonly string[]).includes(raw as string) ? (raw as ModuleState) : 'off'
}

/**
 * Read every tenant_modules row for one tenant via the authenticated client.
 * Returns a map module_key → { state, config }. Modules with no row are ABSENT
 * (callers treat absent as 'off'). Returns {} on any error so a read miss can
 * never crash an admin page — the surface then shows the "not active" notice.
 */
// Prestanda C2: request-scopad cache() — PortalShell OCH modul-sidorna läser
// tenant_modules per request; dedupar dubbla läsningar (RLS-scopat, samma request
// = samma användare).
export const getAdminModuleStates = cache(async (tenantId: string): Promise<AdminModuleStates> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenant_modules')
    .select('module_key, state, config')
    .eq('tenant_id', tenantId)
  if (error || !data) return {}
  const out: AdminModuleStates = {}
  for (const row of data) {
    out[row.module_key] = {
      state: parseState(row.state),
      config: (row.config ?? {}) as Record<string, unknown>,
    }
  }
  return out
})

/** Resolve one module's state from the map (absent → 'off'). */
export function moduleAdminState(states: AdminModuleStates, key: string): ModuleState {
  return states[key]?.state ?? 'off'
}

/**
 * True when the tenant has activated the module (draft/live/paused) — i.e. the
 * admin surface should be usable. 'off' or missing → not active (show notice).
 */
export function isModuleActivated(states: AdminModuleStates, key: string): boolean {
  return moduleAdminState(states, key) !== 'off'
}

/**
 * Booking-specialfallet (speglar lib/tenant-modules.ts DEFAULT_MODULE_STATE):
 * före tenant_modules fanns körde varje tenant booking — en SAKNAD booking-rad
 * betyder därför "live", inte "off". Endast en EXPLICIT off-rad stänger av.
 */
export function isBookingActivated(states: AdminModuleStates): boolean {
  return !('booking' in states) || isModuleActivated(states, 'booking')
}

/** Read one module's config jsonb (read-only display). Empty object if absent. */
export function moduleAdminConfig(states: AdminModuleStates, key: string): Record<string, unknown> {
  return states[key]?.config ?? {}
}
