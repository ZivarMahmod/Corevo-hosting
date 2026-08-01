import { describe, expect, it, vi } from 'vitest'

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }))
vi.mock('@/lib/observability', () => ({
  logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const { deliverIssuedGiftCards } = await import('./gift')

describe('deliverIssuedGiftCards', () => {
  it('fails closed without reading or exposing a database-stored raw code', async () => {
    const client = { from: vi.fn() }
    const result = await deliverIssuedGiftCards(client as never, 'tenant-1', 'order-1')

    expect(result).toEqual({ attempted: 0, failed: 1 })
    expect(client.from).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('gift.deliver.goal92_required', {
      tenantId: 'tenant-1',
      orderId: 'order-1',
    })
  })
})
