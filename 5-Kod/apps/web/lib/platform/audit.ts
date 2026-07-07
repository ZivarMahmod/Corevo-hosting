import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { platformCtx } from './guard'

// Append-only platform audit trail (audit_log, migration 0001/0002). audit_log is
// tenant-scoped (tenant_id NOT NULL), so each platform action is logged against
// the tenant it touched, with the platform admin as actor. RLS permits the insert
// via private.is_platform_admin(). Best-effort: a failed audit insert never blocks
// the action it records.

export type PlatformAuditAction =
  | 'tenant.create'
  | 'tenant.suspend'
  | 'tenant.activate'
  | 'tenant.delete' // soft delete (status='deleted') — admin context then resolves to null
  | 'tenant.branding'
  | 'tenant.billing'
  | 'tenant.invite'
  // Operativ data-kontroll (M7 §2.1B) — no-code "Supabase med mitt UI".
  | 'tenant.update' // edit safe tenant fields (name, review url, booking variant)
  | 'tenant.password_reset' // generate a recovery link for the salon admin
  | 'tenant.staff_create' // Zivar-assisted staff onboarding on a chosen tenant
  | 'tenant.staff_update' // super-admin edits a staff member (title/active) on a chosen tenant
  | 'tenant.staff_remove' // super-admin soft-removes (active=false) a staff member on a chosen tenant
  | 'tenant.staff_schedule' // super-admin sets a staff member's weekly working_hours on a chosen tenant
  | 'tenant.service_create' // super-admin adds a service to a chosen tenant (ongoing services management)
  | 'tenant.service_update' // super-admin edits a service (name/price/duration/active) on a chosen tenant
  | 'tenant.service_delete' // super-admin deletes a service on a chosen tenant
  | 'tenant.customer_create' // goal-22: manual customer row on a chosen tenant (a Zivar/platform act — NOT a customer.* event, so the actor-classifier reads it as Zivar)
  | 'tenant.module_state' // multi-bransch spår 5: super-admin set a tenant module's lifecycle state (off/draft/live/paused) on /salonger/[id]
  | 'tenant.content_slot' // multi-bransch spår 4: super-admin swapped a storefront content slot's image (visual hub) on /salonger/[id]
  | 'tenant.sajtbyggare' // per-tenant edit-toggle: platform turned the site editor on/off for a chosen tenant
  | 'platform.help_mode_open' // platform admin opens help-mode for a tenant (logged platform-side)
  | 'platform.role_permissions_save' // goal-21: edit the global RBAC permission matrix
  | 'domain.add' // goal-23: provision a custom hostname + tenant_domains row
  | 'domain.verify' // goal-23: poll CF DCV status → mark tenant_domains.verified
  | 'domain.remove' // goal-23: delete custom hostname + tenant_domains row

export async function logPlatformAction(
  supabase: SupabaseClient<Database>,
  args: {
    action: PlatformAuditAction
    tenantId: string
    actorId: string
    entityId?: string | null
    meta?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      tenant_id: args.tenantId,
      actor_profile_id: args.actorId,
      action: args.action,
      entity: 'tenant',
      entity_id: args.entityId ?? args.tenantId,
      meta: (args.meta ?? {}) as Database['public']['Tables']['audit_log']['Insert']['meta'],
    })
  } catch {
    // audit is non-critical telemetry — swallow so the real action still succeeds.
  }
}

export type AuditRow = Database['public']['Tables']['audit_log']['Row']

// ── Cross-tenant audit stream (Drift & logg §2.3) ───────────────────────────────
// Same RLS-bypass seam as the rest of lib/platform/*: the platform_admin JWT lets
// audit_log return rows for EVERY tenant. Read-only — never mutates the log
// (build-once-never-delete). The action keys are dotted enums (e.g.
// 'tenant.suspend', 'booking.status.pending'); the view maps them to a human label
// + icon + tone. We classify the actor + tone here so the (read) and the (render)
// don't both have to know the action vocabulary.

export type AuditActor = 'Zivar' | 'System' | 'Kund'
export type AuditTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

export type PlatformAuditEntry = {
  id: string
  at: string // ISO created_at — the view formats it ("idag 09:14")
  action: string // raw dotted action key (the view humanizes it)
  entity: string
  tenant: string // salon NAME (or "—" when the tenant join is missing)
  slug: string
  actorId: string | null
  actor: AuditActor
  tone: AuditTone
}

/**
 * Classify who an audit row is attributable to, for the actor filter
 * (Alla/Zivar/System/Kund). A platform action (tenant.*) with an actor is Zivar;
 * a customer-driven booking change is Kund; everything actor-less is System.
 */
export function classifyAuditActor(action: string, actorId: string | null): AuditActor {
  if (action.startsWith('tenant.')) return 'Zivar'
  if (action.startsWith('booking.') || action.startsWith('customer.')) {
    return actorId ? 'Kund' : 'System'
  }
  return actorId ? 'Zivar' : 'System'
}

/** Map an action key to a status tone for the row icon (muted, not loud). */
export function classifyAuditTone(action: string): AuditTone {
  if (action.includes('delete') || action.includes('blocked') || action.includes('suspend'))
    return action.includes('suspend') ? 'warning' : 'danger'
  if (action.includes('cancel')) return 'warning'
  if (action.includes('create') || action.includes('complete') || action.includes('activate'))
    return 'success'
  if (action.startsWith('booking.')) return 'neutral'
  return 'info'
}

export type AuditFilters = { q?: string; actor?: AuditActor | 'all' }

type AuditQueryRow = AuditRow & {
  tenants: { slug: string; name: string } | { slug: string; name: string }[] | null
}

/**
 * Recent audit-log entries cross-tenant (RLS bypass), newest first. Free-text
 * matches the action/entity; the actor filter is applied in JS because the actor
 * is a derived classification, not a stored column. Honest empty-state: returns []
 * when nothing matches (the view writes "Inget matchar").
 */
export async function listAuditLogAllTenants(
  filters: AuditFilters = {},
  limit = 100,
): Promise<PlatformAuditEntry[]> {
  const { supabase } = await platformCtx()
  let q = supabase
    .from('audit_log')
    .select('id, created_at, action, entity, actor_profile_id, tenant_id, tenants(name, slug)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters.q && filters.q.trim()) {
    const safe = filters.q.trim().replace(/[,()*"\\]/g, ' ')
    const term = `%${safe}%`
    q = q.or(`action.ilike.${term},entity.ilike.${term}`)
  }

  const { data } = await q
  let rows = ((data ?? []) as AuditQueryRow[]).map((a) => {
    const t = Array.isArray(a.tenants) ? a.tenants[0] : a.tenants
    return {
      id: a.id,
      at: a.created_at,
      action: a.action,
      entity: a.entity,
      tenant: t?.name ?? '—',
      slug: t?.slug ?? '',
      actorId: a.actor_profile_id,
      actor: classifyAuditActor(a.action, a.actor_profile_id),
      tone: classifyAuditTone(a.action),
    }
  })

  if (filters.actor && filters.actor !== 'all') {
    rows = rows.filter((r) => r.actor === filters.actor)
  }
  return rows
}
