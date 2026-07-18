import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import {
  reconcileAmbiguousStaffInvite,
  type StaffInviteReconcileResult,
} from './staff-invite-compensation'

type ServiceClient = SupabaseClient<Database>

export type ExistingStaffInviteProfile = {
  id: string
  status: string
  reusable: boolean
}

export async function findExistingStaffInviteProfile(
  service: ServiceClient,
  args: { email: string; tenantId: string; roleId: string },
): Promise<{ ok: boolean; profile: ExistingStaffInviteProfile | null }> {
  const { data, error } = await service
    .from('users')
    .select('id, status')
    .eq('email', args.email)
    .eq('tenant_id', args.tenantId)
    .eq('role_id', args.roleId)
    .maybeSingle()
  if (error) return { ok: false, profile: null }
  if (!data) return { ok: true, profile: null }
  if (data.status !== 'active') {
    return { ok: true, profile: { ...data, reusable: false } }
  }

  const authResult = await service.auth.admin.getUserById(data.id)
  const authUser = authResult.data?.user
  const bannedUntil = authUser?.banned_until ? Date.parse(authUser.banned_until) : Number.NaN
  const banned = Boolean(authUser?.banned_until) &&
    (!Number.isFinite(bannedUntil) || bannedUntil > Date.now())
  const deleted = Boolean(authUser?.deleted_at)
  return {
    ok: true,
    profile: {
      ...data,
      reusable: !authResult.error && Boolean(authUser) && !banned && !deleted,
    },
  }
}

export async function findStaffInviteBinding(
  service: ServiceClient,
  args: { tenantId: string; authId: string; targetStaffId?: string },
): Promise<{
  ok: boolean
  staffId: string | null
  profileId: string | null
  authBoundStaffId: string | null
}> {
  const authBindingQuery = args.authId
    ? service
        .from('staff')
        .select('id, profile_id')
        .eq('tenant_id', args.tenantId)
        .eq('profile_id', args.authId)
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null })
  const targetQuery = args.targetStaffId
    ? service
        .from('staff')
        .select('id, profile_id')
        .eq('tenant_id', args.tenantId)
        .eq('id', args.targetStaffId)
        .limit(1)
        .maybeSingle()
    : authBindingQuery

  const [target, authBinding] = await Promise.all([targetQuery, authBindingQuery])
  if (target.error || authBinding.error) {
    return { ok: false, staffId: null, profileId: null, authBoundStaffId: null }
  }
  return {
    ok: true,
    staffId: target.data?.id ?? null,
    profileId: target.data?.profile_id ?? null,
    authBoundStaffId: authBinding.data?.id ?? null,
  }
}

type IncidentReporter = (event: {
  stage: string
  tenantId: string
  containmentOk: boolean
}) => Promise<void>

/**
 * Production adapter for the pure compensation state machine. Every destructive
 * step is checked, and the database deletion is delegated to the atomic 0098 RPC.
 */
export async function compensateFailedStaffInvite(
  service: ServiceClient,
  args: {
    authId: string
    tenantId: string
    roleId: string
    targetStaffId?: string
    reportIncident: IncidentReporter
  },
): Promise<StaffInviteReconcileResult> {
  return reconcileAmbiguousStaffInvite({
    authId: args.authId,
    tenantId: args.tenantId,
    roleId: args.roleId,
    ...(args.targetStaffId ? { targetStaffId: args.targetStaffId } : {}),
    deps: {
      readState: async (ids) => {
        const [profileResult, binding] = await Promise.all([
          service
            .from('users')
            .select('tenant_id, role_id')
            .eq('id', ids.authId)
            .maybeSingle(),
          findStaffInviteBinding(service, {
            tenantId: ids.tenantId,
            authId: ids.authId,
            targetStaffId: args.targetStaffId,
          }),
        ])
        if (profileResult.error || !binding.ok) return { ok: false }
        return {
          ok: true,
          staffProfileId: binding.profileId,
          authBoundStaffId: binding.authBoundStaffId,
          profile: profileResult.data
            ? {
                // Global platform users are never valid staff invite targets.
                // Normalize a nullable global tenant to a guaranteed mismatch.
                tenantId: profileResult.data.tenant_id ?? '',
                // A legacy/null role is deliberately a mismatch, never an exact
                // provisional profile eligible for deletion.
                roleId: profileResult.data.role_id ?? '',
              }
            : null,
        }
      },
      prepareProfileCleanup: async (ids) => {
        const rpc = service.rpc as unknown as (
          fn: string,
          params: Record<string, string>,
        ) => Promise<{ data: string | null; error: unknown }>
        const { data, error } = await rpc('prepare_staff_invite_cleanup', {
          p_auth_user: ids.authId,
          p_tenant: ids.tenantId,
          p_role: ids.roleId,
        })
        return {
          ok: !error && (data === 'profile_deleted' || data === 'profile_absent'),
        }
      },
      containProfile: async (ids) => {
        const rpc = service.rpc as unknown as (
          fn: string,
          params: Record<string, string>,
        ) => Promise<{ data: string | null; error: unknown }>
        const { data, error } = await rpc('contain_staff_invite_profile', {
          p_auth_user: ids.authId,
          p_tenant: ids.tenantId,
          p_role: ids.roleId,
        })
        if (error) return { status: 'failed' as const }
        if (data === 'profile_contained') return { status: 'contained' as const }
        if (data === 'profile_absent') return { status: 'absent' as const }
        if (data === 'staff_linked') return { status: 'winner' as const }
        return { status: 'failed' as const }
      },
      deleteAuthUser: async (authId) => {
        const { error } = await service.auth.admin.deleteUser(authId)
        return { ok: !error }
      },
      banAuthUser: async (authId) => {
        const { error } = await service.auth.admin.updateUserById(authId, {
          // Long-lived containment. Ops can unban after repairing the exact rows.
          ban_duration: '876000h',
        })
        return { ok: !error }
      },
      reportIncident: args.reportIncident,
    },
  })
}
