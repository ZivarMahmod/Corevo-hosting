export type StaffInviteIds = {
  authId: string
  tenantId: string
  roleId: string
  targetStaffId?: string
}

export type StaffInviteReadState =
  | {
      ok: true
      /** profile_id currently present on the requested target row. */
      staffProfileId: string | null
      /** Staff row already owning this auth id, checked independently. */
      authBoundStaffId: string | null
      profile: { tenantId: string; roleId: string } | null
    }
  | { ok: false }

export type StaffInviteCompensationDeps = {
  readState: (ids: StaffInviteIds) => Promise<StaffInviteReadState>
  /** Atomic DB guard: deletes only when the exact profile still has no staff link. */
  prepareProfileCleanup: (ids: StaffInviteIds) => Promise<{ ok: boolean }>
  containProfile: (
    ids: StaffInviteIds,
  ) => Promise<{ status: 'contained' | 'absent' | 'winner' | 'failed' }>
  deleteAuthUser: (authId: string) => Promise<{ ok: boolean }>
  banAuthUser: (authId: string) => Promise<{ ok: boolean }>
  reportIncident: (event: {
    stage: string
    tenantId: string
    containmentOk: boolean
  }) => Promise<void>
}

export type StaffInviteReconcileResult = {
  status:
    | 'committed'
    | 'cleaned'
    | 'conflict_preserved'
    | 'manual_cleanup_required'
    | 'containment_failed'
  containmentOk?: boolean
}

async function safeResult(call: () => Promise<{ ok: boolean }>): Promise<boolean> {
  try {
    return (await call()).ok
  } catch {
    return false
  }
}

async function containAndReport(args: {
  ids: StaffInviteIds
  deps: StaffInviteCompensationDeps
  stage: string
}): Promise<StaffInviteReconcileResult> {
  let profileContainment: 'contained' | 'absent' | 'winner' | 'failed' = 'failed'
  try {
    profileContainment = (await args.deps.containProfile(args.ids)).status
  } catch {
    profileContainment = 'failed'
  }

  // The auth id acquired a staff row after our first read. That row is the
  // concurrent winner: do not delete, quarantine, or ban it.
  if (profileContainment === 'winner') return { status: 'conflict_preserved' }

  const authContainmentOk = await safeResult(() => args.deps.banAuthUser(args.ids.authId))
  const containmentOk =
    (profileContainment === 'contained' || profileContainment === 'absent') &&
    authContainmentOk
  try {
    await args.deps.reportIncident({
      stage: args.stage,
      tenantId: args.ids.tenantId,
      containmentOk,
    })
  } catch {
    // Telemetry never changes the explicit manual-cleanup outcome.
  }
  return containmentOk
    ? { status: 'manual_cleanup_required', containmentOk: true }
    : { status: 'containment_failed', containmentOk: false }
}

/**
 * Resolve an ambiguous staff/profile write without deleting a concurrent winner.
 * The DB cleanup callback must be the atomic 0098 RPC, which locks the exact
 * public.users row and refuses deletion if any staff row acquired the auth id.
 */
export async function reconcileAmbiguousStaffInvite(args: StaffInviteIds & {
  deps: StaffInviteCompensationDeps
}): Promise<StaffInviteReconcileResult> {
  const ids: StaffInviteIds = {
    authId: args.authId,
    tenantId: args.tenantId,
    roleId: args.roleId,
    ...(args.targetStaffId ? { targetStaffId: args.targetStaffId } : {}),
  }
  let state: StaffInviteReadState
  try {
    state = await args.deps.readState(ids)
  } catch {
    state = { ok: false }
  }
  if (!state.ok) return containAndReport({ ids, deps: args.deps, stage: 'reconcile_read_failed' })

  const exactProfile =
    state.profile?.tenantId === ids.tenantId && state.profile.roleId === ids.roleId

  if (state.authBoundStaffId) {
    if (ids.targetStaffId && state.authBoundStaffId !== ids.targetStaffId) {
      return { status: 'conflict_preserved' }
    }
    if (state.staffProfileId === ids.authId && exactProfile) {
      return { status: 'committed' }
    }
    if (!ids.targetStaffId && exactProfile) return { status: 'committed' }
    // A linked account is never cleanup material. The containment RPC performs
    // the same locked check and will preserve it if this read raced.
    return containAndReport({ ids, deps: args.deps, stage: 'linked_profile_mismatch' })
  }

  // Target is unbound or another account won its CAS. Cleanup is allowed only
  // through the atomic DB function, which also checks that this loser auth id
  // did not concurrently win a DIFFERENT staff row.
  const profilePrepared = await safeResult(() => args.deps.prepareProfileCleanup(ids))
  if (!profilePrepared) {
    return containAndReport({ ids, deps: args.deps, stage: 'profile_cleanup_failed' })
  }

  const authDeleted = await safeResult(() => args.deps.deleteAuthUser(ids.authId))
  if (!authDeleted) {
    return containAndReport({ ids, deps: args.deps, stage: 'auth_delete_failed' })
  }
  return { status: 'cleaned' }
}
