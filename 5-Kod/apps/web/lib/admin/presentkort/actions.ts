'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdminArea, type CurrentUser } from '@/lib/auth/session'
import {
  getAdminTenant,
  requireActiveTenantMutation,
  type AdminTenant,
} from '@/lib/admin/tenant'
import type { ActionState } from '@/lib/admin/actions'
import { kronorToCents } from './types'
import { commerceReleaseGate } from '@/lib/release/commerce'
import { createGiftCardCode, hashGiftCardCode } from '@/lib/security/gift-card-code'
import {
  checkRateLimitFailClosed,
  getClientIp,
  LIMITS,
  rateLimitKey,
} from '@/lib/security/rate-limit'

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

export type GiftCardActionState = ActionState & {
  issuedCode?: string
  issuedCardId?: string
}

async function adminCtx(): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  const user = await requireAdminArea('presentkort')
  const tenant = await getAdminTenant(user)
  if (!tenant) return null
  await requireActiveTenantMutation(user, tenant.id)
  if (!commerceReleaseGate(tenant.id).presentkort) return null
  return { user, tenant }
}

function requestIdOf(formData: FormData): string | null {
  const requestId = String(formData.get('requestId') ?? '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    requestId,
  )
    ? requestId
    : null
}

function commandError(error: { message?: string } | null): string {
  const message = error?.message ?? ''
  if (message.includes('value_module_not_live'))
    return 'Presentkort måste vara live för den här åtgärden.'
  if (message.includes('gift_card_value_not_released'))
    return 'Presentkort är inte frisläppt för det här företaget.'
  if (message.includes('gift_card_insufficient_balance'))
    return 'Presentkortet har inte tillräckligt saldo.'
  if (message.includes('gift_card_expired')) return 'Presentkortet har gått ut.'
  if (message.includes('gift_card_void')) return 'Presentkortet är makulerat.'
  if (message.includes('gift_card_unavailable')) return 'Koden kunde inte användas.'
  if (message.includes('gift_card_idempotency_conflict'))
    return 'Förfrågan har redan använts med andra uppgifter.'
  if (message.includes('gift_card_not_voidable'))
    return 'Presentkortet kan inte makuleras i sitt nuvarande läge.'
  return GENERIC
}

export async function issueGiftCard(
  _previousState: GiftCardActionState,
  formData: FormData,
): Promise<GiftCardActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const requestId = requestIdOf(formData)
  if (!requestId) return { error: 'Förfrågan saknar giltigt id.' }

  const amountCents = kronorToCents(Number(formData.get('amountKr')))
  if (amountCents < 100 || amountCents > 10_000_000) {
    return { error: 'Ange ett belopp mellan 1 och 100 000 kr.' }
  }

  const recipientName = String(formData.get('recipientName') ?? '').trim() || null
  const recipientEmail = String(formData.get('recipientEmail') ?? '').trim() || null
  const message = String(formData.get('message') ?? '').trim() || null
  const expiresAt = String(formData.get('expiresAt') ?? '').trim() || null
  if ((recipientName?.length ?? 0) > 120 || (recipientEmail?.length ?? 0) > 320) {
    return { error: 'Mottagaruppgifterna är för långa.' }
  }
  if ((message?.length ?? 0) > 2_000) return { error: 'Meddelandet är för långt.' }

  let code
  try {
    code = await createGiftCardCode(
      ctx.tenant.id,
      requestId,
      process.env.GIFT_CARD_HMAC_KEY ?? '',
    )
  } catch {
    return { error: 'Presentkort är inte korrekt driftkonfigurerat.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('issue_gift_card', {
    p_tenant: ctx.tenant.id,
    p_code_hash: code.codeHash,
    p_code_last_four: code.lastFour,
    p_amount_cents: amountCents,
    p_currency: 'SEK',
    p_recipient_name: recipientName,
    p_recipient_email: recipientEmail,
    p_message: message,
    p_expires_at: expiresAt,
    p_idempotency_key: requestId,
  })
  if (error || !data || typeof data !== 'object') return { error: commandError(error) }

  const result = data as { gift_card_id?: unknown }
  revalidatePath('/admin/presentkort')
  return {
    success: 'Presentkort utfärdat.',
    issuedCode: code.rawCode,
    issuedCardId: typeof result.gift_card_id === 'string' ? result.gift_card_id : undefined,
  }
}

export async function redeemGiftCard(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const requestId = requestIdOf(formData)
  const rawCode = String(formData.get('code') ?? '').trim()
  const amountCents = kronorToCents(Number(formData.get('amountKr')))
  const currency = String(formData.get('currency') ?? 'SEK').trim().toUpperCase()
  if (!requestId || !rawCode || amountCents < 1 || amountCents > 10_000_000) {
    return { error: 'Kontrollera kod och belopp.' }
  }

  const ip = await getClientIp()
  if (
    !(await checkRateLimitFailClosed(
      rateLimitKey('gift_card_code', ctx.tenant.id, ctx.user.id, ip),
      LIMITS.giftCardCode,
    ))
  ) {
    return { error: 'För många kodförsök. Vänta en stund och försök igen.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('redeem_gift_card', {
    p_tenant: ctx.tenant.id,
    p_code_hash: await hashGiftCardCode(rawCode),
    p_amount_cents: amountCents,
    p_currency: currency,
    p_idempotency_key: requestId,
    p_source_type: 'admin',
  })
  if (error) return { error: commandError(error) }

  revalidatePath('/admin/presentkort')
  return { success: 'Beloppet har lösts in.' }
}

export async function voidGiftCard(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(formData.get('id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  const requestId = requestIdOf(formData)
  if (!id || !requestId) return { error: 'Saknar presentkort eller förfrågnings-id.' }
  if (!reason || reason.length > 500) return { error: 'Ange en kort orsak till makuleringen.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('void_gift_card', {
    p_tenant: ctx.tenant.id,
    p_gift_card: id,
    p_idempotency_key: requestId,
    p_reason: reason,
  })
  if (error) return { error: commandError(error) }

  revalidatePath('/admin/presentkort')
  return { success: 'Presentkort makulerat.' }
}
