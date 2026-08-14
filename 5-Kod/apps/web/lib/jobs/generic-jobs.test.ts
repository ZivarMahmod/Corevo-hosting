import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import { dispatchGenericJobs } from './generic-jobs'

const job = {
  v: 1,
  type: 'stripe.billing.reconcile',
  eventId: 'evt_1',
  objectId: 'in_1',
}

function row(message: unknown = job, readCt = 1) {
  return { msg_id: 41, read_ct: readCt, message }
}

function client(readRows: unknown[]) {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'read_corevo_jobs') return { data: readRows, error: null }
    return { data: true, error: null }
  })
  mocks.createServiceClient.mockReturnValue({ rpc })
  return rpc
}

describe('generic PGMQ jobs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('archives only after the registered effect succeeds', async () => {
    const rpc = client([row()])
    const handler = vi.fn(async () => undefined)

    await expect(dispatchGenericJobs({ 'stripe.billing.reconcile': handler })).resolves.toEqual({
      claimed: 1,
      completed: 1,
      retried: 0,
      reviewRequired: 0,
    })

    expect(handler).toHaveBeenCalledWith(job)
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['read_corevo_jobs', 'archive_corevo_job'])
  })

  it('leaves a failed effect unarchived for visibility-timeout redelivery', async () => {
    const rpc = client([row()])
    const handler = vi.fn(async () => {
      throw new Error('provider details')
    })

    await expect(dispatchGenericJobs({ 'stripe.billing.reconcile': handler })).resolves.toEqual({
      claimed: 1,
      completed: 0,
      retried: 1,
      reviewRequired: 0,
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('dead-letters unknown versions immediately and max-attempt failures at eight reads', async () => {
    const rpc = client([row({ ...job, v: 2 }), { ...row(job, 8), msg_id: 42 }])
    const handler = vi.fn(async () => {
      throw new Error('closed')
    })

    await expect(dispatchGenericJobs({ 'stripe.billing.reconcile': handler })).resolves.toEqual({
      claimed: 2,
      completed: 0,
      retried: 0,
      reviewRequired: 2,
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'fail_corevo_job_for_review', {
      p_msg_id: 41,
      p_reason: 'unknown_version',
    })
    expect(rpc).toHaveBeenNthCalledWith(3, 'fail_corevo_job_for_review', {
      p_msg_id: 42,
      p_reason: 'max_attempts',
    })
  })

  it('does not acknowledge a completed effect when archive fails', async () => {
    const rpc = client([row()])
    rpc.mockImplementation(async (name: string) =>
      name === 'read_corevo_jobs'
        ? { data: [row()], error: null }
        : { data: null, error: { code: 'db_down' } },
    )

    await expect(
      dispatchGenericJobs({
        'stripe.billing.reconcile': async () => undefined,
      }),
    ).rejects.toThrow('generic_jobs_archive_corevo_job_failed')
  })

  it('fails closed when the service-role client or queue response is unavailable', async () => {
    mocks.createServiceClient.mockReturnValue(null)
    await expect(dispatchGenericJobs({})).rejects.toThrow('generic_jobs_service_unavailable')

    client({ not: 'an array' } as unknown as unknown[])
    await expect(dispatchGenericJobs({})).rejects.toThrow('generic_jobs_read_invalid')
  })
})
