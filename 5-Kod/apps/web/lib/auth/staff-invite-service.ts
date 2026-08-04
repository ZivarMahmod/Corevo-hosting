import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { inviteRedirectUrl } from './invite'
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
  const banned =
    Boolean(authUser?.banned_until) && (!Number.isFinite(bannedUntil) || bannedUntil > Date.now())
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

export type StaffInviteProvisionResult =
  | { ok: true; inviteSent: boolean; alreadyLinked: boolean }
  | { ok: false; error: string }

type StaffInviteIncidentReporter = (event: {
  stage: string
  tenantId: string
  containmentOk?: boolean
}) => Promise<void>

function provisionFailure(result: StaffInviteReconcileResult): StaffInviteProvisionResult | null {
  if (result.status === 'committed') return null
  if (result.status === 'conflict_preserved') {
    return {
      ok: false,
      error: 'Kontot är redan kopplat till en annan medarbetare och lämnades orört.',
    }
  }
  if (result.status === 'manual_cleanup_required' && result.containmentOk) {
    return {
      ok: false,
      error:
        'manual_cleanup_required: Kontot spärrades men kunde inte städas automatiskt. Kontakta drift och kontrollera incidentloggen innan en ny inbjudan skickas.',
    }
  }
  if (result.status === 'containment_failed') {
    return {
      ok: false,
      error:
        'containment_failed: Kontot kunde inte spärras fullständigt. Kontakta drift omedelbart och skicka ingen ny inbjudan.',
    }
  }
  return {
    ok: false,
    error: 'Inbjudan kunde inte slutföras. Det provisoriska kontot städades; försök igen.',
  }
}

export async function provisionStaffInvite(args: {
  service: ServiceClient
  accountClient: ServiceClient
  tenantId: string
  email: string
  targetStaffId?: string
  createStaff: (authId: string) => Promise<{ error: unknown }>
  reportIncident: StaffInviteIncidentReporter
}): Promise<StaffInviteProvisionResult> {
  await args.accountClient
    .from('roles')
    .upsert(
      { tenant_id: args.tenantId, name: 'staff', level: 3 },
      { onConflict: 'tenant_id,name', ignoreDuplicates: true },
    )
  const { data: role, error: roleError } = await args.accountClient
    .from('roles')
    .select('id')
    .eq('tenant_id', args.tenantId)
    .eq('name', 'staff')
    .maybeSingle()
  if (roleError || !role) return { ok: false, error: 'Något gick fel. Försök igen.' }

  const compensate = (authId: string) =>
    compensateFailedStaffInvite(args.service, {
      authId,
      tenantId: args.tenantId,
      roleId: role.id,
      ...(args.targetStaffId ? { targetStaffId: args.targetStaffId } : {}),
      reportIncident: async (event) => args.reportIncident(event),
    })

  let existing = await findExistingStaffInviteProfile(args.service, {
    email: args.email,
    tenantId: args.tenantId,
    roleId: role.id,
  })
  if (!existing.ok) return { ok: false, error: 'Något gick fel. Försök igen.' }
  if (existing.profile && !existing.profile.reusable) {
    return {
      ok: false,
      error:
        'manual_cleanup_required: Ett inaktivt konto finns redan för e-postadressen. Aktivera eller städa kontot innan ny inbjudan.',
    }
  }

  if (args.targetStaffId) {
    const target = await findStaffInviteBinding(args.service, {
      tenantId: args.tenantId,
      authId: existing.profile?.id ?? '',
      targetStaffId: args.targetStaffId,
    })
    if (!target.ok || !target.staffId) return { ok: false, error: 'Medarbetaren saknas.' }
    if (target.authBoundStaffId && target.authBoundStaffId !== args.targetStaffId) {
      return { ok: false, error: 'Kontot är redan kopplat till en annan medarbetare.' }
    }
    if (target.profileId) {
      if (existing.profile?.id === target.profileId) {
        return { ok: true, inviteSent: false, alreadyLinked: true }
      }
      return { ok: false, error: 'Medarbetaren har redan ett annat inloggningskonto.' }
    }
  }

  let authId = existing.profile?.id ?? ''
  let inviteSent = false
  if (!authId) {
    const { data: invited, error: inviteError } = await args.service.auth.admin.inviteUserByEmail(
      args.email,
      {
        redirectTo: inviteRedirectUrl('staff'),
      },
    )
    if (inviteError || !invited.user) {
      existing = await findExistingStaffInviteProfile(args.service, {
        email: args.email,
        tenantId: args.tenantId,
        roleId: role.id,
      })
      if (!existing.ok || !existing.profile || !existing.profile.reusable) {
        return { ok: false, error: 'Inbjudan misslyckades. Kontot kunde inte återfinnas säkert.' }
      }
      authId = existing.profile.id
    } else {
      authId = invited.user.id
      inviteSent = true
    }
  }

  if (!inviteSent) {
    const binding = await findStaffInviteBinding(args.service, {
      tenantId: args.tenantId,
      authId,
      ...(args.targetStaffId ? { targetStaffId: args.targetStaffId } : {}),
    })
    if (!binding.ok) {
      return {
        ok: false,
        error: 'manual_cleanup_required: Kontots personalkoppling kunde inte verifieras.',
      }
    }
    if (
      args.targetStaffId &&
      binding.authBoundStaffId &&
      binding.authBoundStaffId !== args.targetStaffId
    ) {
      return { ok: false, error: 'Kontot är redan kopplat till en annan medarbetare.' }
    }
    if (binding.profileId === authId) {
      return { ok: true, inviteSent: false, alreadyLinked: true }
    }
    if (args.targetStaffId && binding.profileId && binding.profileId !== authId) {
      return { ok: false, error: 'Medarbetaren har redan ett annat inloggningskonto.' }
    }
  }

  const { error: metadataError } = await args.service.auth.admin.updateUserById(authId, {
    app_metadata: { tenant_id: args.tenantId, platform_admin: false },
  })
  if (metadataError) {
    if (!inviteSent) {
      await args.reportIncident({
        stage: 'existing_staff_metadata_update_failed',
        tenantId: args.tenantId,
      })
      return {
        ok: false,
        error:
          'manual_cleanup_required: Det befintliga kontots företagskoppling kunde inte verifieras.',
      }
    }
    return (
      provisionFailure(await compensate(authId)) ?? {
        ok: false,
        error:
          'manual_cleanup_required: Kontot kopplades men metadata behöver verifieras av drift.',
      }
    )
  }

  if (inviteSent) {
    const { error: profileError } = await args.accountClient.from('users').insert({
      id: authId,
      tenant_id: args.tenantId,
      email: args.email,
      role_id: role.id,
      status: 'active',
    })
    if (profileError) {
      const failure = provisionFailure(await compensate(authId))
      if (failure) return failure
    }
  }

  const staffWrite = await args.createStaff(authId)
  if (staffWrite.error) {
    if (!inviteSent) {
      const binding = await findStaffInviteBinding(args.service, {
        tenantId: args.tenantId,
        authId,
        ...(args.targetStaffId ? { targetStaffId: args.targetStaffId } : {}),
      })
      if (!binding.ok) {
        return {
          ok: false,
          error: 'manual_cleanup_required: Personalkopplingen kunde inte verifieras.',
        }
      }
      const committed = args.targetStaffId
        ? binding.profileId === authId && binding.authBoundStaffId === args.targetStaffId
        : binding.profileId === authId
      if (!committed) {
        return args.targetStaffId
          ? {
              ok: false,
              error:
                'Medarbetaren kopplades av en annan inbjudan. Det befintliga kontot lämnades orört.',
            }
          : { ok: false, error: 'Något gick fel. Försök igen.' }
      }
    } else {
      const failure = provisionFailure(await compensate(authId))
      if (failure) return failure
    }
  }
  return { ok: true, inviteSent, alreadyLinked: false }
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
          service.from('users').select('tenant_id, role_id').eq('id', ids.authId).maybeSingle(),
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
