import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  platformCtx: vi.fn(),
  audit: vi.fn(),
  report: vi.fn(),
}))

vi.mock('../guard', () => ({ platformCtx: () => mocks.platformCtx() }))
vi.mock('../audit', () => ({ logPlatformAction: (...args: unknown[]) => mocks.audit(...args) }))
vi.mock('./observe', () => ({ reportActionError: (...args: unknown[]) => mocks.report(...args) }))
vi.mock('../service', () => ({ createServiceClient: vi.fn(), hasServiceRole: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/admin/tenant', () => ({ revalidateTenantById: vi.fn() }))
vi.mock('@/lib/auth/invite', () => ({ inviteRedirectUrl: vi.fn() }))
vi.mock('@/lib/auth/staff-invite-service', () => ({
  compensateFailedStaffInvite: vi.fn(),
  findExistingStaffInviteProfile: vi.fn(),
  findStaffInviteBinding: vi.fn(),
}))

import { revealPlatformCustomerContact } from './people'

function client(opts: {
  relationship?: { data: unknown; error: unknown }
  rpc?: { data: unknown; error: unknown }
} = {}) {
  const relationship = opts.relationship ?? {
    data: { id: 'customer-1', tenant_id: 'tenant-1' },
    error: null,
  }
  const rpcResult = opts.rpc ?? {
    data: [
      {
        display_name: 'Anna',
        full_name: 'Anna Andersson',
        email: 'anna@example.se',
        phone: '070-123 45 67',
        pii_visible: true,
      },
    ],
    error: null,
  }
  return {
    rpc: vi.fn(async (name: string) =>
      name === 'platform_customer_safe_rows'
        ? {
            data: relationship.data ? [relationship.data] : [],
            error: relationship.error,
          }
        : rpcResult,
    ),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-18T10:00:00.000Z'))
  mocks.audit.mockResolvedValue({ ok: true })
})

afterEach(() => vi.useRealTimers())

describe('revealPlatformCustomerContact', () => {
  it('går alltid genom platformCtx-grinden', async () => {
    mocks.platformCtx.mockRejectedValue(new Error('forbidden'))

    await expect(
      revealPlatformCustomerContact({ customerId: 'customer-1', tenantId: 'tenant-1' }),
    ).rejects.toThrow('forbidden')
  })

  it('avvisar kund-id som inte hör till angiven tenant innan RPC/audit', async () => {
    const supabase = client({ relationship: { data: null, error: null } })
    mocks.platformCtx.mockResolvedValue({ user: { id: 'admin-1' }, supabase })

    const result = await revealPlatformCustomerContact({
      customerId: 'customer-other',
      tenantId: 'tenant-1',
    })

    expect(result).toEqual({ ok: false, error: 'Kunden finns inte hos det här företaget.' })
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('platform_customer_safe_rows', {
      p_tenant: 'tenant-1',
      p_customer: 'customer-other',
      p_limit: 1,
    })
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it('låter get_customer_contact vara sanningen för driftfönstret', async () => {
    const supabase = client({
      rpc: {
        data: [
          {
            display_name: 'Anna',
            full_name: null,
            email: null,
            phone: null,
            pii_visible: false,
          },
        ],
        error: null,
      },
    })
    mocks.platformCtx.mockResolvedValue({ user: { id: 'admin-1' }, supabase })

    const result = await revealPlatformCustomerContact({
      customerId: 'customer-1',
      tenantId: 'tenant-1',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('get_customer_contact', {
      p_customer: 'customer-1',
    })
    expect(result).toEqual({
      ok: false,
      error: 'Kontaktuppgifterna är inte tillgängliga utanför driftfönstret.',
    })
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it('returnerar aldrig kontakt när audit-insert misslyckas', async () => {
    const supabase = client()
    mocks.platformCtx.mockResolvedValue({ user: { id: 'admin-1' }, supabase })
    mocks.audit.mockResolvedValue({ ok: false })

    const result = await revealPlatformCustomerContact({
      customerId: 'customer-1',
      tenantId: 'tenant-1',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Kontaktuppgifterna kunde inte loggas och visas därför inte.',
    })
    expect(JSON.stringify(result)).not.toContain('anna@example.se')
    expect(JSON.stringify(result)).not.toContain('070-123 45 67')
    expect(mocks.report).toHaveBeenCalledWith(
      'revealPlatformCustomerContact.audit',
      expect.any(Error),
      { tenantId: 'tenant-1', customerId: 'customer-1' },
    )
  })

  it('auditerar utan PII och returnerar kontakt med serverägd 15-minutersexpiry', async () => {
    const supabase = client()
    mocks.platformCtx.mockResolvedValue({ user: { id: 'admin-1' }, supabase })

    const result = await revealPlatformCustomerContact({
      customerId: 'customer-1',
      tenantId: 'tenant-1',
    })

    expect(result).toEqual({
      ok: true,
      contact: { email: 'anna@example.se', phone: '070-123 45 67' },
      expiresAt: '2026-07-18T10:15:00.000Z',
    })
    const auditArgs = mocks.audit.mock.calls[0]?.[1]
    expect(auditArgs).toEqual({
      action: 'tenant.customer_pii_reveal',
      tenantId: 'tenant-1',
      actorId: 'admin-1',
      entityId: 'customer-1',
    })
    expect(JSON.stringify(auditArgs)).not.toContain('anna@example.se')
    expect(JSON.stringify(auditArgs)).not.toContain('070-123 45 67')
  })
})
