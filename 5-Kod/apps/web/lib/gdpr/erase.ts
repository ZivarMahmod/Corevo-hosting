import 'server-only'
import { createServiceClient } from '@/lib/platform/service'
import { logger } from '@/lib/observability'

// The database owns the tenant/customer transaction (0099). The application
// only orchestrates the one operation PostgreSQL cannot include: deleting the
// Supabase Auth identity. Self-service is therefore a deliberate two-phase flow:
//
//  1. atomic_erase_self_customer_account scrubs tenant PII, blocks the public
//     profile and writes a private pending cleanup marker in one transaction;
//  2. Auth Admin deletes auth.users; only that explicit success lets the app
//     report the account erased. Failure stays contained and operationally
//     retryable, and is returned truthfully as auth_cleanup_required.
//
// Global identity remains a product decision. Self-service only proceeds when
// the Auth UUID has exactly one exact customer relation. It never guesses by
// matching email or phone across tenants.

export type EraseResult =
  | { ok: true; erasedBookings: number; status: 'erased' | 'already_erased' }
  | {
      ok: false
      reason:
        | 'unavailable'
        | 'error'
        | 'global_identity_decision_required'
        | 'auth_cleanup_required'
    }

type AtomicEraseRow = {
  status: 'erased' | 'already_erased'
  erased_bookings: number
  auth_user_id: string | null
}

type CleanupClaimRow = {
  cleanup_id: string
  tenant_id: string
  customer_id: string
  auth_user_id: string
  erase_status: 'erased' | 'already_erased'
  erased_bookings: number
}

type RpcError = { message: string }

function atomicRow(data: unknown): AtomicEraseRow | null {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const candidate = row as Partial<AtomicEraseRow>
  if (
    (candidate.status !== 'erased' && candidate.status !== 'already_erased') ||
    typeof candidate.erased_bookings !== 'number'
  ) {
    return null
  }
  return {
    status: candidate.status,
    erased_bookings: candidate.erased_bookings,
    auth_user_id: typeof candidate.auth_user_id === 'string' ? candidate.auth_user_id : null,
  }
}

function cleanupClaim(
  data: unknown,
  expectedAuthUser: string,
  expectedTenant: string,
): CleanupClaimRow | null {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const candidate = row as Partial<CleanupClaimRow>
  if (
    typeof candidate.cleanup_id !== 'string' ||
    candidate.auth_user_id !== expectedAuthUser ||
    candidate.tenant_id !== expectedTenant ||
    typeof candidate.customer_id !== 'string' ||
    (candidate.erase_status !== 'erased' && candidate.erase_status !== 'already_erased') ||
    typeof candidate.erased_bookings !== 'number'
  ) {
    return null
  }
  return candidate as CleanupClaimRow
}

function cleanupClaimId(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const cleanupId = (row as { cleanup_id?: unknown }).cleanup_id
  return typeof cleanupId === 'string' ? cleanupId : null
}

function rpcFailureReason(error: RpcError | null): 'global_identity_decision_required' | 'error' {
  return error?.message.includes('global_identity_decision_required')
    ? 'global_identity_decision_required'
    : 'error'
}

export async function eraseCustomerData(args: {
  userId: string
  tenantId: string
  actorId: string
}): Promise<EraseResult> {
  const { userId, tenantId, actorId } = args
  if (!userId || !tenantId || actorId !== userId) return { ok: false, reason: 'error' }

  const admin = createServiceClient()
  if (!admin) {
    logger.warn('gdpr.erase.unavailable', { code: 'service_role_missing' })
    return { ok: false, reason: 'unavailable' }
  }

  const claimToken = crypto.randomUUID()
  let phaseOneRow: AtomicEraseRow | null = null
  let claimed: CleanupClaimRow | null = null

  const claimPendingCleanup = async (): Promise<CleanupClaimRow | null> => {
    try {
      const { data, error } = await admin.rpc('claim_customer_erasure_auth_cleanup', {
        p_auth_user: userId,
        p_claim_token: claimToken,
        p_lease_seconds: 60,
      })
      if (error) return null
      const exactClaim = cleanupClaim(data, userId, tenantId)
      if (exactClaim) return exactClaim

      // The RPC may already have leased a row before a malformed/mismatched
      // response is rejected locally. Release only through the token-bound CAS;
      // the DB independently requires cleanup id + expected Auth UUID + token.
      const rejectedCleanupId = cleanupClaimId(data)
      if (rejectedCleanupId) {
        const release = await admin.rpc('fail_customer_erasure_auth_cleanup', {
          p_cleanup_id: rejectedCleanupId,
          p_auth_user: userId,
          p_claim_token: claimToken,
          p_error_code: 'cleanup_identity_mismatch',
        })
        logger.error('gdpr.erase.cleanup_claim_rejected', {
          code: release.error ? 'release_failed' : 'identity_mismatch',
        })
      }
      return null
    } catch {
      return null
    }
  }

  const releaseContainedCleanup = async (
    row: CleanupClaimRow,
    code: 'auth_delete_failed' | 'auth_provider_unavailable' | 'auth_delete_uncertain',
  ): Promise<void> => {
    // Banning is a best-effort second containment layer. Supabase access JWTs
    // already issued cannot be revoked, so the DB booking guard remains the
    // authoritative fence even if the provider is unavailable.
    try {
      const { error: banError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: '876000h',
      })
      if (banError) logger.warn('gdpr.erase.auth_ban_failed', { code: 'provider_rejected' })
    } catch {
      logger.warn('gdpr.erase.auth_ban_failed', { code: 'provider_unavailable' })
    }

    try {
      const { error } = await admin.rpc('fail_customer_erasure_auth_cleanup', {
        p_cleanup_id: row.cleanup_id,
        p_auth_user: userId,
        p_claim_token: claimToken,
        p_error_code: code,
      })
      if (error) logger.error('gdpr.erase.cleanup_release_failed', { code: 'rpc_error' })
    } catch {
      logger.error('gdpr.erase.cleanup_release_failed', { code: 'rpc_unavailable' })
    }
  }

  const authUserIsAbsent = async (): Promise<boolean | null> => {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (!error) return !data.user
      const candidate = error as { status?: number; code?: string }
      if (candidate.status === 404 || candidate.code === 'user_not_found') return true
      return null
    } catch {
      return null
    }
  }

  try {
    const { data, error } = await admin.rpc('atomic_erase_self_customer_account', {
      p_tenant: tenantId,
      p_auth_user: userId,
    })

    if (error) {
      const reason = rpcFailureReason(error)
      if (reason === 'global_identity_decision_required') {
        logger.warn('gdpr.erase.rpc_failed', { code: reason })
        return { ok: false, reason }
      }
      // A previous/lost successful phase one has no customer binding left. The
      // durable marker, not the failed rediscovery, decides whether to resume.
      claimed = await claimPendingCleanup()
      if (!claimed) {
        logger.warn('gdpr.erase.rpc_failed', { code: 'transaction_rejected' })
        return { ok: false, reason: 'error' }
      }
      phaseOneRow = {
        status: claimed.erase_status,
        erased_bookings: claimed.erased_bookings,
        auth_user_id: claimed.auth_user_id,
      }
    } else {
      phaseOneRow = atomicRow(data)
      if (!phaseOneRow || phaseOneRow.auth_user_id !== userId) {
        const invalidCode = phaseOneRow
          ? 'phase_one_auth_mismatch'
          : 'phase_one_result_invalid'
        // A malformed/lost success response is not proof of containment. Only
        // an exact marker claimed by the requested Auth UUID + tenant may resume.
        claimed = await claimPendingCleanup()
        if (!claimed) {
          logger.error('gdpr.erase.invalid_rpc_result', { code: invalidCode })
          return { ok: false, reason: 'error' }
        }
        phaseOneRow = {
          status: claimed.erase_status,
          erased_bookings: claimed.erased_bookings,
          auth_user_id: claimed.auth_user_id,
        }
      }
    }
  } catch {
    // The request may have been lost after PostgreSQL committed. Resume only
    // from the exact durable marker. Without that proof we do not know that any
    // containment happened, so the UI must offer an ordinary retry instead of
    // claiming that data is already anonymized or the account is blocked.
    claimed = await claimPendingCleanup()
    if (!claimed) {
      logger.error('gdpr.erase.phase_one_uncertain', { code: 'resume_unavailable' })
      return { ok: false, reason: 'error' }
    }
    phaseOneRow = {
      status: claimed.erase_status,
      erased_bookings: claimed.erased_bookings,
      auth_user_id: claimed.auth_user_id,
    }
  }

  if (!claimed) claimed = await claimPendingCleanup()
  if (!claimed || !phaseOneRow) {
    logger.warn('gdpr.erase.cleanup_claim_failed', { code: 'retry_required' })
    return { ok: false, reason: 'error' }
  }

  let authDeleted = false
  try {
    const { error: authError } = await admin.auth.admin.deleteUser(userId)
    if (!authError) {
      authDeleted = true
    } else {
      authDeleted = (await authUserIsAbsent()) === true
      if (!authDeleted) {
        await releaseContainedCleanup(claimed, 'auth_delete_failed')
        logger.warn('gdpr.erase.auth_delete_failed', { code: 'provider_rejected' })
        return { ok: false, reason: 'auth_cleanup_required' }
      }
    }
  } catch {
    // A thrown provider call is ambiguous: verify authoritative Auth state before
    // either acknowledging deletion or releasing the lease for operations.
    authDeleted = (await authUserIsAbsent()) === true
    if (!authDeleted) {
      await releaseContainedCleanup(claimed, 'auth_delete_uncertain')
      logger.warn('gdpr.erase.auth_delete_failed', { code: 'provider_uncertain' })
      return { ok: false, reason: 'auth_cleanup_required' }
    }
  }

  const ackArgs = {
    p_cleanup_id: claimed.cleanup_id,
    p_auth_user: userId,
    p_claim_token: claimToken,
  }
  try {
    let acknowledgement = await admin.rpc('ack_customer_erasure_auth_cleanup', ackArgs)
    if (acknowledgement.error) {
      acknowledgement = await admin.rpc('ack_customer_erasure_auth_cleanup', ackArgs)
    }
    if (acknowledgement.error || acknowledgement.data !== true) {
      logger.error('gdpr.erase.cleanup_ack_failed', { code: 'manual_reconciliation_required' })
      return { ok: false, reason: 'auth_cleanup_required' }
    }
  } catch {
    logger.error('gdpr.erase.cleanup_ack_failed', { code: 'rpc_unavailable' })
    return { ok: false, reason: 'auth_cleanup_required' }
  }

  logger.info('gdpr.erase.done', {
    erasedBookings: phaseOneRow.erased_bookings,
    status: phaseOneRow.status,
  })
  return {
    ok: true,
    erasedBookings: phaseOneRow.erased_bookings,
    status: phaseOneRow.status,
  }
}

/**
 * Owner-initiated erasure is deliberately tenant-scoped. It anonymizes the
 * exact customer card and every customer-linked PII band in that tenant but
 * never deletes a potentially shared Auth identity. The customer's own account
 * erasure path above is the only path allowed to run the external Auth phase.
 */
export async function eraseTenantCustomerData(args: {
  customerId: string
  tenantId: string
  actorId: string
}): Promise<EraseResult> {
  const { customerId, tenantId, actorId } = args
  if (!customerId || !tenantId || !actorId) return { ok: false, reason: 'error' }

  const admin = createServiceClient()
  if (!admin) {
    logger.warn('gdpr.tenant_erase.unavailable', { code: 'service_role_missing' })
    return { ok: false, reason: 'unavailable' }
  }

  try {
    const { data, error } = await admin.rpc('atomic_erase_tenant_customer', {
      p_tenant: tenantId,
      p_customer: customerId,
      p_actor: actorId,
    })

    if (error) {
      logger.warn('gdpr.tenant_erase.rpc_failed', { code: 'transaction_rejected' })
      return { ok: false, reason: 'error' }
    }

    const row = atomicRow(data)
    if (!row) {
      logger.error('gdpr.tenant_erase.invalid_rpc_result', { code: 'result_invalid' })
      return { ok: false, reason: 'error' }
    }

    logger.info('gdpr.tenant_erase.done', {
      erasedBookings: row.erased_bookings,
      status: row.status,
    })
    return { ok: true, erasedBookings: row.erased_bookings, status: row.status }
  } catch {
    logger.error('gdpr.tenant_erase.threw', { code: 'unexpected_exception' })
    return { ok: false, reason: 'error' }
  }
}
