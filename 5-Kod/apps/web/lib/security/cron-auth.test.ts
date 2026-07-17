import { afterEach, describe, expect, it } from 'vitest'
import { authorizedCronRequest } from './cron-auth'

const originalCronSecret = process.env.CRON_SECRET

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalCronSecret
})

describe('cron bearer authentication', () => {
  it('fails closed when the secret is absent', async () => {
    const req = new Request('https://example.test', {
      headers: { authorization: 'Bearer anything' },
    })

    await expect(authorizedCronRequest(req)).resolves.toBe(false)
  })

  it('accepts only the exact bearer value', async () => {
    process.env.CRON_SECRET = 'test-secret'

    await expect(authorizedCronRequest(new Request('https://example.test', {
      headers: { authorization: 'Bearer test-secret' },
    }))).resolves.toBe(true)
    await expect(authorizedCronRequest(new Request('https://example.test', {
      headers: { authorization: 'Bearer test-secreu' },
    }))).resolves.toBe(false)
    await expect(authorizedCronRequest(new Request('https://example.test'))).resolves.toBe(false)
  })
})
