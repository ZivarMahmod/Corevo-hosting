import { describe, expect, it, vi } from 'vitest'

const openNextFetch = vi.hoisted(() =>
  vi.fn(async () => new Response('delegated by OpenNext', { status: 200 })),
)

vi.mock('../../motiontest-opennext-worker.mjs', () => ({
  default: { fetch: openNextFetch },
}))

describe('actual motiontest Worker entrypoint', () => {
  it('imports without a generated build and enforces the boundary before mocked OpenNext', async () => {
    const entrypoint = await import('../../motiontest-worker.mjs').catch(() => null)
    expect(entrypoint?.default).toBeDefined()
    if (!entrypoint?.default) return

    expect(Object.keys(entrypoint.default)).toEqual(['fetch'])
    await expect(
      entrypoint.default.fetch(new Request('https://motiontest.corevo.se/'), {}, {}),
    ).resolves.toMatchObject({ status: 200 })

    await expect(
      entrypoint.default.fetch(
        new Request('https://motiontest.corevo.se/', { method: 'POST' }),
        {},
        {},
      ),
    ).resolves.toMatchObject({ status: 405 })
    await expect(
      entrypoint.default.fetch(
        new Request('https://motiontest.corevo.se/api/auth/session'),
        {},
        {},
      ),
    ).resolves.toMatchObject({ status: 404 })

    expect(openNextFetch).toHaveBeenCalledTimes(1)
  })
})
