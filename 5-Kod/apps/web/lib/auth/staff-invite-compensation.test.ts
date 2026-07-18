import { describe, expect, it, vi } from 'vitest'
import { reconcileAmbiguousStaffInvite } from './staff-invite-compensation'

const IDS = {
  authId: 'auth-loser',
  tenantId: 'tenant-a',
  roleId: 'role-staff',
  targetStaffId: 'staff-target',
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    readState: vi.fn(async () => ({
      ok: true as const,
      staffProfileId: null,
      authBoundStaffId: null,
      profile: { tenantId: IDS.tenantId, roleId: IDS.roleId },
    })),
    prepareProfileCleanup: vi.fn(async () => ({ ok: true as const })),
    deleteAuthUser: vi.fn(async () => ({ ok: true as const })),
    banAuthUser: vi.fn(async () => ({ ok: true as const })),
    containProfile: vi.fn(async () => ({ status: 'contained' as const })),
    reportIncident: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('staff invite compensation', () => {
  it('treats an ambiguous write as committed when both exact rows prove success', async () => {
    const d = deps({
      readState: vi.fn(async () => ({
        ok: true as const,
        staffProfileId: IDS.authId,
        authBoundStaffId: IDS.targetStaffId,
        profile: { tenantId: IDS.tenantId, roleId: IDS.roleId },
      })),
    })
    await expect(reconcileAmbiguousStaffInvite({ ...IDS, deps: d })).resolves.toEqual({ status: 'committed' })
    expect(d.prepareProfileCleanup).not.toHaveBeenCalled()
    expect(d.deleteAuthUser).not.toHaveBeenCalled()
  })

  it('cleans only the loser when another profile won the staff CAS', async () => {
    const d = deps({
      readState: vi.fn(async () => ({
        ok: true as const,
        staffProfileId: 'auth-winner',
        authBoundStaffId: null,
        profile: { tenantId: IDS.tenantId, roleId: IDS.roleId },
      })),
    })
    await expect(reconcileAmbiguousStaffInvite({ ...IDS, deps: d })).resolves.toEqual({ status: 'cleaned' })
    expect(d.prepareProfileCleanup).toHaveBeenCalledWith(IDS)
    expect(d.deleteAuthUser).toHaveBeenCalledWith(IDS.authId)
    expect(d.deleteAuthUser).not.toHaveBeenCalledWith('auth-winner')
  })

  it('marks the exact profile non-active and bans auth when guarded cleanup fails', async () => {
    const d = deps({ prepareProfileCleanup: vi.fn(async () => ({ ok: false as const })) })
    await expect(reconcileAmbiguousStaffInvite({ ...IDS, deps: d })).resolves.toEqual({
      status: 'manual_cleanup_required',
      containmentOk: true,
    })
    expect(d.deleteAuthUser).not.toHaveBeenCalled()
    expect(d.containProfile).toHaveBeenCalledWith(IDS)
    expect(d.banAuthUser).toHaveBeenCalledWith(IDS.authId)
    expect(d.reportIncident).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'profile_cleanup_failed', tenantId: IDS.tenantId }),
    )
  })

  it('bans and reports the shell when auth deletion fails', async () => {
    const d = deps({ deleteAuthUser: vi.fn(async () => ({ ok: false as const })) })
    await expect(reconcileAmbiguousStaffInvite({ ...IDS, deps: d })).resolves.toEqual({
      status: 'manual_cleanup_required',
      containmentOk: true,
    })
    expect(d.banAuthUser).toHaveBeenCalledWith(IDS.authId)
    expect(d.reportIncident).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'auth_delete_failed', tenantId: IDS.tenantId }),
    )
  })

  it('never guesses through an ambiguous reconciliation read', async () => {
    const d = deps({ readState: vi.fn(async () => ({ ok: false as const })) })
    await expect(reconcileAmbiguousStaffInvite({ ...IDS, deps: d })).resolves.toEqual({
      status: 'manual_cleanup_required',
      containmentOk: true,
    })
    expect(d.prepareProfileCleanup).not.toHaveBeenCalled()
    expect(d.deleteAuthUser).not.toHaveBeenCalled()
    expect(d.banAuthUser).toHaveBeenCalledWith(IDS.authId)
  })

  it('contains half-committed state instead of deleting a linked account', async () => {
    const d = deps({
      containProfile: vi.fn(async () => ({ status: 'winner' as const })),
      readState: vi.fn(async () => ({
        ok: true as const,
        staffProfileId: IDS.authId,
        authBoundStaffId: IDS.targetStaffId,
        profile: null,
      })),
    })
    await expect(reconcileAmbiguousStaffInvite({ ...IDS, deps: d })).resolves.toEqual({
      status: 'conflict_preserved',
    })
    expect(d.prepareProfileCleanup).not.toHaveBeenCalled()
    expect(d.deleteAuthUser).not.toHaveBeenCalled()
  })

  it('preserves an auth account already bound to a different staff row', async () => {
    const d = deps({
      readState: vi.fn(async () => ({
        ok: true as const,
        staffProfileId: null,
        authBoundStaffId: 'staff-a',
        profile: { tenantId: IDS.tenantId, roleId: IDS.roleId },
      })),
    })
    await expect(reconcileAmbiguousStaffInvite({ ...IDS, deps: d })).resolves.toEqual({
      status: 'conflict_preserved',
    })
    expect(d.prepareProfileCleanup).not.toHaveBeenCalled()
    expect(d.containProfile).not.toHaveBeenCalled()
    expect(d.deleteAuthUser).not.toHaveBeenCalled()
    expect(d.banAuthUser).not.toHaveBeenCalled()
  })

  it('reports containment_failed and never claims a ban when Auth containment fails', async () => {
    const d = deps({
      prepareProfileCleanup: vi.fn(async () => ({ ok: false as const })),
      banAuthUser: vi.fn(async () => ({ ok: false as const })),
    })
    await expect(reconcileAmbiguousStaffInvite({ ...IDS, deps: d })).resolves.toEqual({
      status: 'containment_failed',
      containmentOk: false,
    })
    expect(d.reportIncident).toHaveBeenCalledWith(
      expect.objectContaining({ containmentOk: false }),
    )
  })

  it('returns containment_failed if the durable profile quarantine cannot be written', async () => {
    const d = deps({
      prepareProfileCleanup: vi.fn(async () => ({ ok: false as const })),
      containProfile: vi.fn(async () => ({ status: 'failed' as const })),
    })
    await expect(reconcileAmbiguousStaffInvite({ ...IDS, deps: d })).resolves.toEqual({
      status: 'containment_failed',
      containmentOk: false,
    })
  })
})
