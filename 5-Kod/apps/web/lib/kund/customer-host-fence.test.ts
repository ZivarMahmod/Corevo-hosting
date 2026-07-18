import { describe, expect, it } from 'vitest'
import { canRenderCustomerPortal } from './customer-host-fence'

describe('customer portal host fence', () => {
  const activeCustomer = {
    roleLevel: 2,
    platformAdmin: false,
    accountTenantId: 'tenant-a',
    hostTenantId: 'tenant-a',
    customerTenantId: 'tenant-a',
    customerStatus: 'active',
  }

  it('allows only an active customer relation when all tenant identities match', () => {
    expect(canRenderCustomerPortal(activeCustomer)).toBe(true)
  })

  it('fails closed for host/account/customer tenant mismatches', () => {
    expect(canRenderCustomerPortal({ ...activeCustomer, hostTenantId: 'tenant-b' })).toBe(false)
    expect(canRenderCustomerPortal({ ...activeCustomer, customerTenantId: 'tenant-b' })).toBe(false)
    expect(canRenderCustomerPortal({ ...activeCustomer, accountTenantId: null })).toBe(false)
  })

  it('denies inactive or missing customer relations and higher back-office roles', () => {
    expect(canRenderCustomerPortal({ ...activeCustomer, customerStatus: 'anonymized' })).toBe(false)
    expect(canRenderCustomerPortal({ ...activeCustomer, customerTenantId: null, customerStatus: null })).toBe(false)
    expect(canRenderCustomerPortal({ ...activeCustomer, roleLevel: 3 })).toBe(false)
    expect(canRenderCustomerPortal({ ...activeCustomer, roleLevel: 8, platformAdmin: true })).toBe(false)
  })
})
