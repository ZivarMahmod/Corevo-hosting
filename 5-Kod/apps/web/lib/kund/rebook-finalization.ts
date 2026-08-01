export type FinalizedCustomerRebook = {
  outcome: 'finalized' | 'already_finalized'
  payment_carried: boolean
}

type RpcResult = { data: unknown; error: unknown }

type RebookFinalizationDependencies = {
  finalize: () => PromiseLike<RpcResult>
  compensate: () => PromiseLike<RpcResult>
}

type SafeRebookFinalization =
  | { ok: true; finalization: FinalizedCustomerRebook }
  | { ok: false }

const DEFINITIVE_REBOOK_ERRORS = new Set([
  'service_role_required',
  'rebook_scope_invalid',
  'rebook_already_finalized',
  'rebook_booking_state_invalid',
  'rebook_payment_not_settled',
  'rebook_payment_identity_missing',
  'rebook_refund_state_conflict',
  'rebook_payment_move_failed',
])

export function isFinalizedCustomerRebook(value: unknown): value is FinalizedCustomerRebook {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return (row.outcome === 'finalized' || row.outcome === 'already_finalized')
    && typeof row.payment_carried === 'boolean'
}

export function isDefinitiveRebookFinalizationError(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const error = value as Record<string, unknown>
  if (!['22023', '42501', '55000'].includes(String(error.code ?? ''))) return false
  const message = String(error.message ?? '')
  return [...DEFINITIVE_REBOOK_ERRORS].some((name) => message.includes(name))
}

function preservedFinalization(value: unknown): FinalizedCustomerRebook | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.outcome !== 'preserved_finalized' || typeof row.payment_carried !== 'boolean') return null
  return { outcome: 'already_finalized', payment_carried: row.payment_carried }
}

async function callRpc(call: () => PromiseLike<RpcResult>): Promise<RpcResult> {
  try {
    return await call()
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * A lost HTTP response is not evidence that the transaction rolled back.
 * Retry the idempotent finalizer once, then let the database reconcile under
 * the same advisory lock. Only that RPC may cancel an uncommitted replacement.
 */
export async function finalizeCustomerRebookSafely(
  dependencies: RebookFinalizationDependencies,
): Promise<SafeRebookFinalization> {
  const first = await callRpc(dependencies.finalize)
  if (!first.error && isFinalizedCustomerRebook(first.data)) {
    return { ok: true, finalization: first.data }
  }

  if (!isDefinitiveRebookFinalizationError(first.error)) {
    const retry = await callRpc(dependencies.finalize)
    if (!retry.error && isFinalizedCustomerRebook(retry.data)) {
      return { ok: true, finalization: retry.data }
    }
  }

  const compensation = await callRpc(dependencies.compensate)
  if (compensation.error) return { ok: false }
  const preserved = preservedFinalization(compensation.data)
  return preserved ? { ok: true, finalization: preserved } : { ok: false }
}
