import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { GiftCardEntryRow, GiftCardRow, GiftCardStatus } from './types'

function parseStatus(raw: string): GiftCardStatus {
  return raw === 'active' || raw === 'redeemed' || raw === 'expired' || raw === 'void'
    ? raw
    : 'active'
}

export async function listGiftCards(tenantId: string): Promise<GiftCardRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('gift_cards')
    .select(
      'id,code_last_four,initial_amount_cents,balance_cents,currency,status,recipient_name,recipient_email,message,expires_at,created_at',
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(500)

  return (data ?? []).map((row) => ({
    id: row.id,
    maskedCode: `••••-${row.code_last_four}`,
    initialAmountCents: row.initial_amount_cents,
    balanceCents: row.balance_cents,
    currency: row.currency,
    status: parseStatus(row.status),
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    message: row.message,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }))
}

export async function listGiftCardEntries(
  tenantId: string,
  limit = 100,
): Promise<GiftCardEntryRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('gift_card_entries')
    .select(
      'id,gift_card_id,amount_cents,balance_after_cents,currency,entry_type,reason,created_at',
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => ({
    id: row.id,
    giftCardId: row.gift_card_id,
    amountCents: row.amount_cents,
    balanceAfterCents: row.balance_after_cents,
    currency: row.currency,
    entryType: row.entry_type,
    reason: row.reason,
    createdAt: row.created_at,
  }))
}
