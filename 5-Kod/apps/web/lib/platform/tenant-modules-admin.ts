'use server'

// Tenant MODULE-state ADMIN layer (multi-bransch spår 5) — the detail-page half.
//
// Sibling to tenant-modules-write.ts (the CREATE-path) and lib/tenant-modules.ts (the
// public storefront READ). This module owns the super-admin DETAIL surface: list a
// tenant's modules (modules catalog LEFT-joined onto its tenant_modules rows) and the
// per-module state writer behind the "Moduler"-card on /salonger/[id].
//
// Why the write passes the DB state-guard (migration 0026 §9): off→draft (module
// ACTIVATION) is super-admin only. Every write here runs under platformCtx → the authed
// cookie client carries the platform_admin JWT claim (private.is_platform_admin()), so
// the guard admits an INSERT/UPDATE that leaves 'off'. A tenant-admin going through
// PostgREST without that claim is blocked (42501) — exactly the contract. RLS on
// tenant_modules also reads platform_admin, so the cross-tenant read/write is allowed.

import { revalidatePath } from 'next/cache'
import { platformCtx } from './guard'
import { logPlatformAction } from './audit'
import { revalidateTenant } from '@/lib/admin/tenant'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'

export type ActionState = { error?: string; success?: string }

const GENERIC = 'Något gick fel. Försök igen.'

/** One row in the detail-page Moduler list: the catalog module joined to this tenant's
 *  state. `state` is the EFFECTIVE state — 'off' when the tenant has no row yet
 *  (activate = create the row). `hasRow` distinguishes "never activated" from an
 *  explicit 'off' row so the UI can show "Aktivera" vs. a state-select. */
export type TenantModuleRow = {
  moduleKey: string
  name: string
  state: ModuleState
  activatedAt: string | null
  hasRow: boolean
}

function isState(v: unknown): v is ModuleState {
  return typeof v === 'string' && (MODULE_STATES as readonly string[]).includes(v)
}

/**
 * List every catalog module with this tenant's state overlaid (platform read,
 * RLS-bypass). The modules catalog is the spine (so modules the tenant has NOT
 * activated still appear, ready to "Aktivera"); tenant_modules supplies state +
 * activated_at where a row exists. Modules without a row read as 'off' / hasRow:false.
 * Sorted by name for a stable card order.
 */
export async function listTenantModules(tenantId: string): Promise<TenantModuleRow[]> {
  const { supabase } = await platformCtx()
  const [catalogRes, ownRes] = await Promise.all([
    supabase.from('modules').select('key, name').order('name', { ascending: true }),
    supabase
      .from('tenant_modules')
      .select('module_key, state, activated_at')
      .eq('tenant_id', tenantId),
  ])

  const catalog = (catalogRes.data ?? []) as { key: string; name: string }[]
  const own = (ownRes.data ?? []) as {
    module_key: string
    state: string
    activated_at: string | null
  }[]
  const byKey = new Map(own.map((r) => [r.module_key, r]))

  return catalog.map((m) => {
    const row = byKey.get(m.key)
    const state = row && isState(row.state) ? row.state : 'off'
    return {
      moduleKey: m.key,
      name: m.name,
      state,
      activatedAt: row?.activated_at ?? null,
      hasRow: Boolean(row),
    }
  })
}

/**
 * Set a module's state for a tenant (super-admin write). Upserts on
 * (tenant_id, module_key): updates an existing row, or inserts one when the module is
 * being ACTIVATED for the first time (off→draft). The DB state-guard admits the write
 * because platformCtx carries platform_admin; activated_at is stamped by the guard the
 * first time state leaves 'off'. Selecting 'off' is allowed too (it parks the module
 * but keeps the row + history — build-once-never-delete; we never .delete()).
 *
 * Form fields: tenantId, moduleKey, state.
 */
export async function setModuleState(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const moduleKey = String(fd.get('moduleKey') ?? '').trim()
  const state = String(fd.get('state') ?? '')
  if (!tenantId || !moduleKey) return { error: 'Saknar salong eller modul.' }
  if (!isState(state)) return { error: 'Ogiltigt modul-läge.' }

  // Fence the key to the real catalog so a stale/typo'd key can never 23503 the insert.
  const { data: mod, error: modErr } = await supabase
    .from('modules')
    .select('key')
    .eq('key', moduleKey)
    .maybeSingle()
  if (modErr) return { error: GENERIC }
  if (!mod) return { error: 'Okänd modul.' }

  // Resolve the tenant slug up front (needed to bust the storefront tag cache).
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  if (tErr || !tenant) return { error: GENERIC }

  // Upsert on the (tenant_id, module_key) unique index: insert on first activation,
  // update otherwise. on_conflict targets the unique constraint so a re-pick of the
  // same module updates state in place instead of erroring. The state-guard (0026 §9)
  // admits this because platformCtx carries platform_admin.
  const { error: wErr } = await supabase
    .from('tenant_modules')
    .upsert({ tenant_id: tenantId, module_key: moduleKey, state }, { onConflict: 'tenant_id,module_key' })
  if (wErr) return { error: GENERIC }

  // Bust the per-tenant storefront cache (module gating reads tenant_modules, tagged
  // tenant:<slug>) + the platform detail/list pages.
  revalidateTenant(tenant.slug)
  revalidatePath('/salonger')
  revalidatePath(`/salonger/${tenantId}`)

  await logPlatformAction(supabase, {
    action: 'tenant.module_state',
    tenantId,
    actorId: user.id,
    meta: { module: moduleKey, state },
  })

  return { success: `Modul "${moduleKey}" satt till ${state}.` }
}
