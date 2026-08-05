import { beforeEach, describe, expect, it, vi } from 'vitest'

const guards = vi.hoisted(() => ({
  platformCtx: vi.fn(),
  platformAdminCtx: vi.fn(),
}))

vi.mock('./guard', () => guards)

import { loadOwnPartnerBilling } from './partners'

type Result = { data: unknown; error: unknown }

function query(result: Result) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    maybeSingle: async () => result,
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function partnerClient(licenses: Result) {
  const rpcResults: Result[] = [
    { data: null, error: null },
    { data: [{ partner_id: 'partner-1' }], error: null },
  ]
  return {
    rpc: vi.fn(async () => rpcResults.shift() ?? { data: null, error: null }),
    from: vi.fn((table: string) =>
      query(
        table === 'partner_license_months'
          ? licenses
          : { data: { sender: 'Corevo' }, error: null },
      ),
    ),
  }
}

describe('partner billing reads', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aggregates each month once and closes it only when every row is closed', async () => {
    const client = partnerClient({
      data: [
        { month: '2026-08', unit_price_ore: 1000, closed_at: '2026-09-01' },
        { month: '2026-08', unit_price_ore: 2000, closed_at: null },
        { month: '2026-07', unit_price_ore: 900, closed_at: '2026-08-01' },
      ],
      error: null,
    })
    guards.platformCtx.mockResolvedValue({
      supabase: client,
      scope: { kind: 'partner', partnerId: 'partner-1' },
    })

    await expect(loadOwnPartnerBilling()).resolves.toMatchObject({
      history: [
        { month: '2026-08', customers: 2, totalOre: 3000, closed: false },
        { month: '2026-07', customers: 1, totalOre: 900, closed: true },
      ],
      smsSender: 'Corevo',
    })
  })

  it('fails closed when one query fails', async () => {
    guards.platformCtx.mockResolvedValue({
      supabase: partnerClient({ data: null, error: { message: 'unavailable' } }),
      scope: { kind: 'partner', partnerId: 'partner-1' },
    })

    await expect(loadOwnPartnerBilling()).rejects.toThrow('partner_billing_unavailable')
  })
})
