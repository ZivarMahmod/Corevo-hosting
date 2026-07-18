export type PlatformIdentity = {
  platformAdmin: boolean
  partnerAdmin: boolean
  partnerId: string | null
}

export type PlatformMembershipState = {
  partnerId: string
  memberStatus: string | null
  partnerStatus: string | null
}

export function isRejectedPartnerIdentity(input: {
  accountAuthorized: boolean
  roleLevel: number
  roleName: string | null
  roleTenantId: string | null
  partnerAdmin: boolean
}): boolean {
  return input.accountAuthorized
    && input.roleLevel === 7
    && input.roleName === 'partner_admin'
    && input.roleTenantId === null
    && !input.partnerAdmin
}

/**
 * Resolve the platform identity from live database state plus the signed
 * platform_admin claim. Partner access deliberately ignores partner JWT hints:
 * membership and partner state are re-read for every server request.
 */
export function resolvePlatformIdentity(input: {
  accountAuthorized: boolean
  roleLevel: number
  roleName: string | null
  roleTenantId: string | null
  appPlatformAdmin: boolean
  membership: PlatformMembershipState | null
}): PlatformIdentity {
  if (!input.accountAuthorized || input.roleTenantId !== null) {
    return { platformAdmin: false, partnerAdmin: false, partnerId: null }
  }

  const platformAdmin =
    input.appPlatformAdmin && input.roleName === 'super_admin' && input.roleLevel === 8
  if (platformAdmin) {
    return { platformAdmin: true, partnerAdmin: false, partnerId: null }
  }

  const partnerAdmin =
    input.roleName === 'partner_admin' &&
    input.roleLevel === 7 &&
    input.membership?.memberStatus === 'active' &&
    input.membership.partnerStatus === 'active'

  return {
    platformAdmin: false,
    partnerAdmin,
    partnerId: partnerAdmin ? input.membership!.partnerId : null,
  }
}
