export type CustomerHostFenceInput = {
  roleLevel: number
  platformAdmin: boolean
  accountTenantId: string | null
  hostTenantId: string | null
  customerTenantId: string | null
  customerStatus: string | null
}

/**
 * The customer portal is not hierarchical: staff/admin roles do not inherit a
 * customer surface. Rendering is allowed only when the active account profile,
 * resolved host and active customer relation name the same tenant.
 */
export function canRenderCustomerPortal(input: CustomerHostFenceInput): boolean {
  if (input.platformAdmin || input.roleLevel !== 2 || input.customerStatus !== 'active') {
    return false
  }
  if (!input.accountTenantId || !input.hostTenantId || !input.customerTenantId) return false
  return (
    input.accountTenantId === input.hostTenantId &&
    input.customerTenantId === input.hostTenantId
  )
}
