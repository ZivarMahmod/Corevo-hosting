import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sendDueReminders: vi.fn() }))
vi.mock('@/lib/notifications/reminders', () => ({ sendDueReminders: mocks.sendDueReminders }))

import { GET } from './route'

const request = () => new Request('https://booking.corevo.se/api/cron/reminders', {
  headers: { authorization: 'Bearer test-secret' },
})
const originalCronSecret = process.env.CRON_SECRET

afterAll(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalCronSecret
})

describe('reminder cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('returnerar körresultatet när batchen lyckas', async () => {
    mocks.sendDueReminders.mockResolvedValue({ scanned: 2, sent: 1, skipped: 1 })
    const response = await GET(request())
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, scanned: 2, sent: 1, skipped: 1 })
  })

  it('svarar 500 så schedulern kan larma och försöka igen', async () => {
    mocks.sendDueReminders.mockRejectedValue(new Error('query failed'))
    const response = await GET(request())
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'cron_failed' })
  })
})
