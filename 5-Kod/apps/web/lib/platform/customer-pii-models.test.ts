import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { CustomerListItem } from './people'
import type { TenantCustomer } from './tenant-customers'
import { maskPhone } from '@/components/portal/ui/pii'

const platformCtxMock = vi.fn()
vi.mock('./guard', () => ({ platformCtx: () => platformCtxMock() }))

import { listCustomersAllTenants } from './people'
import { getTenantCustomers } from './tenant-customers'

type DbResult = { data: unknown; error: unknown }

function query(result: DbResult) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => chain,
    then: <TResult1 = DbResult, TResult2 = never>(
      onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  }
  return chain
}

beforeEach(() => vi.clearAllMocks())

describe('plattformens publika kundmodeller är PII-minimerade', () => {
  it('helmaskerar korta telefonvärden i stället för att exponera hela strängen', () => {
    expect(maskPhone('1')).toBe('••••')
    expect(maskPhone('1234')).toBe('••••')
    expect(maskPhone('12345')).toBe('1234 •• •• ••')
  })

  it('strippar rå kontaktdata ur den tvärgående Insyn-listan före serialisering', async () => {
    const rawEmail = 'anna@example.se'
    const rawPhone = '070-123 45 67'
    const customers = query({
      data: [
        {
          id: 'customer-1',
          full_name: 'Anna',
          display_name: null,
          name_hidden: false,
          email: rawEmail,
          phone: rawPhone,
          status: 'active',
          last_seen_at: null,
          auth_user_id: null,
          tenant_id: 'tenant-1',
          tenants: { slug: 'demo', name: 'Demo' },
          bookings: [{ count: 2 }],
        },
      ],
      error: null,
    })
    platformCtxMock.mockResolvedValue({ supabase: { from: () => customers } })

    const [item] = await listCustomersAllTenants()

    expect(item).toMatchObject({
      maskedEmail: '•••••@•••',
      maskedPhone: '070- •• •• ••',
      hasEmail: true,
      hasPhone: true,
    })
    expect(item).not.toHaveProperty('email')
    expect(item).not.toHaveProperty('phone')
    expect(JSON.stringify(item)).not.toContain(rawEmail)
    expect(JSON.stringify(item)).not.toContain(rawPhone)
  })

  it('strippar rå kontaktdata ur tenantens Kunder-flik före serverkomponenten', async () => {
    const rawEmail = 'bo@example.se'
    const rawPhone = '073-987 65 43'
    const results: Record<string, DbResult> = {
      customers: {
        data: [
          {
            id: 'customer-2',
            full_name: 'Bo',
            display_name: null,
            name_hidden: false,
            email: rawEmail,
            phone: rawPhone,
            status: 'active',
            auth_user_id: null,
            first_seen_at: '2026-07-01T00:00:00.000Z',
            last_seen_at: null,
          },
        ],
        error: null,
      },
      bookings: { data: [], error: null },
      offert_requests: { data: [], error: null },
    }
    platformCtxMock.mockResolvedValue({
      supabase: { from: (table: string) => query(results[table] ?? { data: [], error: null }) },
    })

    const data = await getTenantCustomers('tenant-1')
    const [item] = data.customers

    expect(item).toMatchObject({
      tenantId: 'tenant-1',
      maskedEmail: '•••••@•••',
      maskedPhone: '073- •• •• ••',
      hasEmail: true,
      hasPhone: true,
    })
    expect(item).not.toHaveProperty('email')
    expect(item).not.toHaveProperty('phone')
    expect(JSON.stringify(data)).not.toContain(rawEmail)
    expect(JSON.stringify(data)).not.toContain(rawPhone)
  })

  it('publicerar inga email/phone-fält i klientmodellernas typer', () => {
    expectTypeOf<CustomerListItem>().not.toHaveProperty('email')
    expectTypeOf<CustomerListItem>().not.toHaveProperty('phone')
    expectTypeOf<TenantCustomer>().not.toHaveProperty('email')
    expectTypeOf<TenantCustomer>().not.toHaveProperty('phone')
  })
})
