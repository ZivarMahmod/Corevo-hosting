import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

// Append-only platform audit trail (audit_log, migration 0001/0002). audit_log is
// tenant-scoped (tenant_id NOT NULL), so each platform action is logged against
// the tenant it touched, with the platform admin as actor. RLS permits the insert
// via private.is_platform_admin(). Best-effort: a failed audit insert never blocks
// the action it records.

export type PlatformAuditAction =
  | 'tenant.create'
  | 'tenant.suspend'
  | 'tenant.activate'
  | 'tenant.branding'
  | 'tenant.billing'
  | 'tenant.invite'

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
