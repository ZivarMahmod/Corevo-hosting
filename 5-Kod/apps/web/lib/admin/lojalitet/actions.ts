'use server'

import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/admin/actions'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { createClient } from '@/lib/supabase/server'

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

function requestIdOf(formData: FormData): string | null {
  const requestId = String(formData.get('requestId') ?? '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    requestId,
  )
    ? requestId
    : null
}

function loyaltyError(error: { message?: string } | null): string {
  const message = error?.message ?? ''
  if (message.includes('value_module_not_live'))
    return 'Lojalitet måste vara live för att använda poäng.'
  if (message.includes('loyalty_insufficient_points'))
    return 'Kunden har inte tillräckligt med poäng.'
  if (message.includes('loyalty_reversal_exists'))
    return 'Den inlösen har redan återställts.'
  if (message.includes('loyalty_idempotency_conflict'))
    return 'Förfrågan har redan använts med andra uppgifter.'
  if (message.includes('loyalty_customer_not_found')) return 'Kunden hittades inte.'
  return GENERIC
}

export async function spendLoyaltyPoints(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await moduleCtx(formData, 'lojalitet')
  if (!ctx) return { error: NO_TENANT }

  const customerId = String(formData.get('customerId') ?? '').trim()
  const points = Number(formData.get('points'))
  const note = String(formData.get('note') ?? '').trim() || null
  const requestId = requestIdOf(formData)
  if (!customerId || !requestId || !Number.isInteger(points) || points < 1 || points > 10_000_000) {
    return { error: 'Kontrollera kund och antal poäng.' }
  }
  if ((note?.length ?? 0) > 500) return { error: 'Noteringen är för lång.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('spend_loyalty_points', {
    p_tenant: ctx.tenant.id,
    p_customer: customerId,
    p_points: points,
    p_idempotency_key: requestId,
    p_source_type: 'admin',
    p_note: note,
  })
  if (error) return { error: loyaltyError(error) }

  revalidatePath('/admin/lojalitet')
  return { success: 'Poängen har använts.' }
}

export async function reverseLoyaltySpend(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await moduleCtx(formData, 'lojalitet')
  if (!ctx) return { error: NO_TENANT }

  const entryId = String(formData.get('entryId') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  const requestId = requestIdOf(formData)
  if (!entryId || !requestId || !reason || reason.length > 500) {
    return { error: 'Ange en kort orsak till återställningen.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reverse_loyalty_spend', {
    p_tenant: ctx.tenant.id,
    p_spend_entry: entryId,
    p_idempotency_key: requestId,
    p_reason: reason,
  })
  if (error) return { error: loyaltyError(error) }

  revalidatePath('/admin/lojalitet')
  return { success: 'Poängen har återställts.' }
}
