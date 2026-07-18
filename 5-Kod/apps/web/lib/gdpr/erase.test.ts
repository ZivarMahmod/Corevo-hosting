import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const deleteUser = vi.fn()
const getUserById = vi.fn()
const updateUserById = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/platform/service', () => ({
  createServiceClient: () => ({
    rpc,
    auth: { admin: { deleteUser, getUserById, updateUserById } },
  }),
}))
vi.mock('@/lib/observability', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { eraseCustomerData } from './erase'

const ids = {
  user: '10000000-0000-0000-0000-000000000001',
  tenant: '10000000-0000-0000-0000-000000000002',
  customer: '10000000-0000-0000-0000-000000000003',
  cleanup: '10000000-0000-0000-0000-000000000004',
}

const atomic = {
  status: 'erased',
  erased_bookings: 2,
  auth_user_id: ids.user,
}
const claim = {
  cleanup_id: ids.cleanup,
  tenant_id: ids.tenant,
  customer_id: ids.customer,
  auth_user_id: ids.user,
  erase_status: 'erased',
  erased_bookings: 2,
}

function successfulRpc(name: string) {
  if (name === 'atomic_erase_self_customer_account') {
    return Promise.resolve({ data: [atomic], error: null })
  }
  if (name === 'claim_customer_erasure_auth_cleanup') {
    return Promise.resolve({ data: [claim], error: null })
  }
  if (name === 'ack_customer_erasure_auth_cleanup') {
    return Promise.resolve({ data: true, error: null })
  }
  return Promise.resolve({ data: true, error: null })
}

async function erase() {
  return eraseCustomerData({ userId: ids.user, tenantId: ids.tenant, actorId: ids.user })
}

describe('resumable two-phase customer erasure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockImplementation(successfulRpc)
    deleteUser.mockResolvedValue({ error: null })
    getUserById.mockResolvedValue({ data: { user: { id: ids.user } }, error: null })
    updateUserById.mockResolvedValue({ error: null })
  })

  it('acknowledges only after a claimed Auth deletion succeeds', async () => {
    await expect(erase()).resolves.toEqual({
      ok: true,
      status: 'erased',
      erasedBookings: 2,
    })
    expect(deleteUser).toHaveBeenCalledWith(ids.user)
    expect(rpc).toHaveBeenCalledWith(
      'ack_customer_erasure_auth_cleanup',
      expect.objectContaining({ p_cleanup_id: ids.cleanup, p_auth_user: ids.user }),
    )
  })

  it('resumes from the durable marker when the phase-one response is lost', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'atomic_erase_self_customer_account') throw new Error('lost response')
      return successfulRpc(name)
    })

    await expect(erase()).resolves.toMatchObject({ ok: true, erasedBookings: 2 })
    expect(deleteUser).toHaveBeenCalledTimes(1)
  })

  it('reports a retryable error when phase one throws without a durable marker', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'atomic_erase_self_customer_account') throw new Error('database offline')
      if (name === 'claim_customer_erasure_auth_cleanup') {
        return Promise.resolve({ data: [], error: null })
      }
      return successfulRpc(name)
    })

    await expect(erase()).resolves.toEqual({ ok: false, reason: 'error' })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('reports a retryable error for malformed phase-one success without a marker', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'atomic_erase_self_customer_account') {
        return Promise.resolve({ data: [{ status: 'erased' }], error: null })
      }
      if (name === 'claim_customer_erasure_auth_cleanup') {
        return Promise.resolve({ data: [], error: null })
      }
      return successfulRpc(name)
    })

    await expect(erase()).resolves.toEqual({ ok: false, reason: 'error' })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('resumes malformed phase-one success only from the exact durable marker', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'atomic_erase_self_customer_account') {
        return Promise.resolve({ data: null, error: null })
      }
      return successfulRpc(name)
    })

    await expect(erase()).resolves.toMatchObject({ ok: true, erasedBookings: 2 })
    expect(rpc).toHaveBeenCalledWith(
      'claim_customer_erasure_auth_cleanup',
      expect.objectContaining({ p_auth_user: ids.user }),
    )
  })

  it('never follows an Auth-mismatched RPC row or cleanup marker', async () => {
    const otherUser = '10000000-0000-0000-0000-000000000099'
    rpc.mockImplementation((name: string) => {
      if (name === 'atomic_erase_self_customer_account') {
        return Promise.resolve({
          data: [{ ...atomic, auth_user_id: otherUser }],
          error: null,
        })
      }
      if (name === 'claim_customer_erasure_auth_cleanup') {
        return Promise.resolve({
          data: [{ ...claim, auth_user_id: otherUser }],
          error: null,
        })
      }
      return successfulRpc(name)
    })

    await expect(erase()).resolves.toEqual({ ok: false, reason: 'error' })
    expect(deleteUser).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith(
      'fail_customer_erasure_auth_cleanup',
      expect.objectContaining({
        p_auth_user: ids.user,
        p_cleanup_id: ids.cleanup,
        p_error_code: 'cleanup_identity_mismatch',
      }),
    )
  })

  it('keeps a transient claim failure after valid phase one retryable', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'atomic_erase_self_customer_account') {
        return Promise.resolve({ data: [atomic], error: null })
      }
      if (name === 'claim_customer_erasure_auth_cleanup') {
        return Promise.resolve({ data: null, error: { message: 'temporary outage' } })
      }
      return successfulRpc(name)
    })

    await expect(erase()).resolves.toEqual({ ok: false, reason: 'error' })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('bans and releases the exact lease when Auth returns a delete error', async () => {
    deleteUser.mockResolvedValue({ error: { status: 503 } })

    await expect(erase()).resolves.toEqual({ ok: false, reason: 'auth_cleanup_required' })
    expect(updateUserById).toHaveBeenCalledWith(ids.user, { ban_duration: '876000h' })
    expect(rpc).toHaveBeenCalledWith(
      'fail_customer_erasure_auth_cleanup',
      expect.objectContaining({ p_cleanup_id: ids.cleanup, p_auth_user: ids.user }),
    )
  })

  it('treats a thrown delete with an authoritative 404 as already deleted', async () => {
    deleteUser.mockRejectedValue(new Error('response lost'))
    getUserById.mockResolvedValue({
      data: { user: null },
      error: { status: 404, code: 'user_not_found' },
    })

    await expect(erase()).resolves.toMatchObject({ ok: true })
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('retries an idempotent acknowledgement once', async () => {
    let acknowledgements = 0
    rpc.mockImplementation((name: string) => {
      if (name === 'ack_customer_erasure_auth_cleanup') {
        acknowledgements += 1
        return Promise.resolve(
          acknowledgements === 1
            ? { data: null, error: { message: 'lost ack' } }
            : { data: true, error: null },
        )
      }
      return successfulRpc(name)
    })

    await expect(erase()).resolves.toMatchObject({ ok: true })
    expect(acknowledgements).toBe(2)
  })

  it('never reports full erase when acknowledgement remains uncertain', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'ack_customer_erasure_auth_cleanup') {
        return Promise.resolve({ data: null, error: { message: 'offline' } })
      }
      return successfulRpc(name)
    })

    await expect(erase()).resolves.toEqual({ ok: false, reason: 'auth_cleanup_required' })
  })

  it('a second run resumes an existing marker after customer discovery fails', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'atomic_erase_self_customer_account') {
        return Promise.resolve({ data: null, error: { message: 'gdpr_customer_not_found' } })
      }
      return successfulRpc(name)
    })
    deleteUser.mockResolvedValue({ error: { status: 404 } })
    getUserById.mockResolvedValue({ data: { user: null }, error: { status: 404 } })

    await expect(erase()).resolves.toMatchObject({ ok: true, status: 'erased' })
  })
})
