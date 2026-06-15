import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { GiftCardRow, GiftCardStatus } from './types'

/** DB status string → typed GiftCardStatus (unknown values fall back to 'active'). */
function parseStatus(raw: string): GiftCardStatus {
  switch (raw) {
    case 'active':
    case 'redeemed':
    case 'expired':
    case 'void':
      return raw
    default:
      return 'active'
  }
}

/**
 * Load all gift cards for a tenant, newest first.
 * Tenant-scoped: only rows where tenant_id = tenantId are returned (RLS is
 * defence-in-depth; the explicit .eq is the primary gate). Maps the snake_case DB
 * row onto the camelCase GiftCardRow the UI consumes. Returns [] on any error so a
 * read miss can never crash the admin page.
 */
export async function listGiftCards(tenantId: string): Promise<GiftCardRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('gift_cards')
    .select(
      'id,code,initial_amount_cents,balance_cents,currency,status,recipient_name,recipient_email,message,expires_at,created_at',
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (!data) return []

  return data.map((r) => ({
    id: r.id,
    code: r.code,
    initialAmountCents: r.initial_amount_cents,
    balanceCents: r.balance_cents,
    currency: r.currency,
    status: parseStatus(r.status),
    recipientName: r.recipient_name,
    recipientEmail: r.recipient_email,
    message: r.message,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }))
}
