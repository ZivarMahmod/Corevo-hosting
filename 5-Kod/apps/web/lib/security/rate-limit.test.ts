import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), warn: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/platform/service', () => ({
  createServiceClient: mocks.createServiceClient,
}))
vi.mock('@/lib/observability', () => ({ logger: { warn: mocks.warn } }))
vi.mock('next/headers', () => ({ headers: vi.fn() }))

import { checkRateLimit, checkRateLimitFailClosed, LIMITS } from './rate-limit'

const limit = { max: 8, windowSecs: 300 }

describe('rate limit error policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createServiceClient.mockReturnValue({ rpc: mocks.rpc })
  })

  it('behåller fail-open för låg-risk publika flöden', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'db down' } })
    await expect(checkRateLimit('kontakt:key', limit)).resolves.toBe(true)
  })

  it('failar stängt för login när limiter-DB:n inte kan svara', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'db down' } })
    await expect(checkRateLimitFailClosed('login:key', limit)).resolves.toBe(false)
  })

  it('returnerar limiterbeslutet när RPC:n fungerar', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    await expect(checkRateLimitFailClosed('login:key', limit)).resolves.toBe(false)
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    await expect(checkRateLimitFailClosed('login:key', limit)).resolves.toBe(true)
  })

  it('behandlar ett tomt eller oväntat RPC-svar enligt flödets felpolicy', async () => {
    for (const data of [null, 'true', 1]) {
      mocks.rpc.mockResolvedValue({ data, error: null })
      await expect(checkRateLimit('kontakt:key', limit)).resolves.toBe(true)
      await expect(checkRateLimitFailClosed('login:key', limit)).resolves.toBe(false)
    }
  })

  it('använder en server-only writer så RPC:n kan stängas för anon', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    await expect(checkRateLimit('kontakt:key', limit)).resolves.toBe(true)
    expect(mocks.createServiceClient).toHaveBeenCalledOnce()
  })

  it('behåller respektive felpolicy när serviceklienten saknas', async () => {
    mocks.createServiceClient.mockReturnValue(null)
    await expect(checkRateLimit('kontakt:key', limit)).resolves.toBe(true)
    await expect(checkRateLimitFailClosed('login:key', limit)).resolves.toBe(false)
  })
})

describe('booking PIN limits', () => {
  it('har separata snåla start-, resend- och verify-buckets', () => {
    expect(LIMITS.bookingPinStart).toEqual({ max: 5, windowSecs: 300 })
    expect(LIMITS.bookingPinResend).toEqual({ max: 3, windowSecs: 300 })
    expect(LIMITS.bookingPinVerify).toEqual({ max: 10, windowSecs: 300 })
  })
})
