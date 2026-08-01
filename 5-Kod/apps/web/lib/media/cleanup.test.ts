import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteR2Keys: vi.fn(),
}))

vi.mock('@/lib/r2/upload', () => ({
  deleteR2Keys: mocks.deleteR2Keys,
}))

import { runMediaCleanup } from './cleanup'

const job = {
  job_id: '92920000-0000-0000-0000-000000000201',
  tenant_id: '92920000-0000-0000-0000-000000000001',
  asset_id: '92920000-0000-0000-0000-000000000101',
  r2_keys: ['media/tenant/asset'],
  attempt: 1,
  lease_token: '92920000-0000-0000-0000-000000000301',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.deleteR2Keys.mockResolvedValue(true)
})

describe('runMediaCleanup', () => {
  it('claims, deletes R2, then completes with the same lease', async () => {
    const order: string[] = []
    const rpc = vi.fn(async (name: string) => {
      order.push(name)
      if (name === 'claim_media_cleanup_jobs') return { data: [job], error: null }
      if (name === 'complete_media_cleanup_job') return { data: true, error: null }
      return { data: null, error: { message: `unexpected ${name}` } }
    })
    mocks.deleteR2Keys.mockImplementation(async () => {
      order.push('r2.delete')
      return true
    })

    await expect(runMediaCleanup({ rpc } as never, 5)).resolves.toEqual({
      claimed: 1,
      deleted: 1,
      retried: 0,
      failed: 0,
    })
    expect(order).toEqual([
      'claim_media_cleanup_jobs',
      'r2.delete',
      'complete_media_cleanup_job',
    ])
    expect(rpc).toHaveBeenLastCalledWith('complete_media_cleanup_job', {
      p_job: job.job_id,
      p_lease_token: job.lease_token,
    })
  })

  it('records a durable retry instead of completing when R2 delete fails', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'claim_media_cleanup_jobs') return { data: [job], error: null }
      if (name === 'retry_media_cleanup_job') return { data: true, error: null }
      return { data: null, error: { message: `unexpected ${name}` } }
    })
    mocks.deleteR2Keys.mockResolvedValue(false)

    await expect(runMediaCleanup({ rpc } as never, 5)).resolves.toEqual({
      claimed: 1,
      deleted: 0,
      retried: 1,
      failed: 0,
    })
    expect(rpc).toHaveBeenLastCalledWith('retry_media_cleanup_job', {
      p_job: job.job_id,
      p_lease_token: job.lease_token,
      p_error: 'r2_delete_failed',
      p_retry_after_seconds: 60,
    })
    expect(rpc).not.toHaveBeenCalledWith(
      'complete_media_cleanup_job',
      expect.anything(),
    )
  })
})
