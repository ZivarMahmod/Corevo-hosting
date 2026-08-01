import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { logger } from '@/lib/observability'

/**
 * Goal 91 removes raw gift-card codes from the database. The old delivery worker
 * can therefore no longer reconstruct a code after settlement. Goal 92 must pass
 * the one-time raw code directly from atomic issuance to a durable secret-safe
 * delivery claim before this rail can reopen.
 */
export async function deliverIssuedGiftCards(
  _supabase: SupabaseClient<Database>,
  tenantId: string,
  orderId: string,
): Promise<{ attempted: number; failed: number }> {
  logger.warn('gift.deliver.goal92_required', { tenantId, orderId })
  return { attempted: 0, failed: 1 }
}
