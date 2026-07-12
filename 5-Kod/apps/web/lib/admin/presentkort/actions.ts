'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal, type CurrentUser } from '@/lib/auth/session'
import { getAdminTenant, type AdminTenant } from '@/lib/admin/tenant'
import type { ActionState } from '@/lib/admin/actions'
import { giftCardVoidable, giftStatusLabel, kronorToCents, type GiftCardStatus } from './types'

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'
const CODE_CLASH = 'Kunde inte skapa kod, försök igen.'

/**
 * Authorization fence for every gift-card mutation. Mirrors lib/admin/shop/actions.ts:
 * requirePortal('admin') + getAdminTenant, which together verify the caller's role AND
 * resolve the tenant (id + slug) for scoped writes. RLS is defence-in-depth, not a
 * substitute.
 */
async function adminCtx(): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return null
  return { user, tenant }
}

// Unambiguous code alphabet — excludes 0/O and 1/I so handwritten/spoken codes
// don't get transcribed wrong. 32 symbols.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Generate a XXXX-XXXX-XXXX-XXXX code (4 groups of 4) from the safe alphabet. */
function generateGiftCode(): string {
  const groups: string[] = []
  for (let g = 0; g < 4; g++) {
    let group = ''
    for (let c = 0; c < 4; c++) {
      group += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    groups.push(group)
  }
  return groups.join('-')
}

/**
 * Issue a new gift card (administrative registration — NOT a payment).
 *
 * Registers a gift card the salon sold or gave out. balance_cents is set equal to
 * initial_amount_cents on issue; this action NEVER touches payment_status/provider
 * (those columns don't exist on gift_cards — online purchase + redemption arrive
 * when payment is switched on). The code is generated server-side and is unique
 * per tenant; on a unique-collision we retry once with a fresh code.
 */
export async function issueGiftCard(formData: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const amountKr = Number(formData.get('amountKr'))
  if (!Number.isFinite(amountKr) || amountKr < 1) {
    return { error: 'Ange ett belopp på minst 1 kr.' }
  }
  const amountCents = kronorToCents(amountKr)

  const recipientNameRaw = String(formData.get('recipientName') ?? '').trim()
  const recipientName = recipientNameRaw || null

  const recipientEmailRaw = String(formData.get('recipientEmail') ?? '').trim()
  const recipientEmail = recipientEmailRaw || null

  const messageRaw = String(formData.get('message') ?? '').trim()
  const message = messageRaw || null

  const expiresAtRaw = String(formData.get('expiresAt') ?? '').trim()
  const expiresAt = expiresAtRaw || null

  const supabase = await createClient()

  // Try to insert with a generated code; on a unique-collision (23505) retry once.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.from('gift_cards').insert({
      tenant_id: ctx.tenant.id,
      code: generateGiftCode(),
      initial_amount_cents: amountCents,
      balance_cents: amountCents,
      currency: 'SEK',
      status: 'active',
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      message,
      expires_at: expiresAt,
    })

    if (!error) {
      revalidatePath('/admin/presentkort')
      return { success: 'Presentkort skapat.' }
    }

    // 23505 = unique_violation (code clash). Anything else is a hard failure.
    if (error.code !== '23505') return { error: GENERIC }
  }

  return { error: CODE_CLASH }
}

/**
 * Makulera (void) a gift card — administrative cancellation. Sets status='void'.
 * NEVER mutates balance_cents (the recorded value stays intact for audit); this is
 * not a refund or redemption, just marking the card unusable.
 *
 * SPÅRBARHET: raden RADERAS ALDRIG. Ett utfärdat värdebevis får inte försvinna ur
 * historiken — makulering är ett status-byte (active → void), inte ett delete.
 *
 * STATUS-VAKT (server-fence): bara ett 'active'-kort kan makuleras, via
 * giftCardVoidable. UI:t döljer redan knappen för icke-aktiva kort, men en
 * server-action är en publik HTTP-yta — utan den här kollen kan en handgjord POST
 * skriva 'void' över ett redan inlöst kort och därmed förfalska historiken.
 */
export async function voidGiftCard(formData: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Saknar presentkort.' }

  const supabase = await createClient()

  // Läs nuvarande status tenant-scopat (samma fence som skrivningen nedan) — en
  // rad som inte tillhör tenanten finns helt enkelt inte.
  const { data: current } = await supabase
    .from('gift_cards')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!current) return { error: 'Presentkortet hittades inte.' }
  if (!giftCardVoidable(current.status as GiftCardStatus)) {
    return { error: `Kortet är ${giftStatusLabel(current.status as GiftCardStatus).toLowerCase()} och kan inte makuleras.` }
  }

  const { error } = await supabase
    .from('gift_cards')
    .update({ status: 'void' })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .eq('status', 'active') // race-fence: kortet får inte hinna lösas in mellan läsning och skrivning
  if (error) return { error: GENERIC }

  revalidatePath('/admin/presentkort')
  return { success: 'Presentkort makulerat.' }
}
