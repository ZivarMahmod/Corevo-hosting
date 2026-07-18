'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { isBillingModel, kronorToCents } from '../billing'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── FLÖDE 2: billing model + fees ───────────────────────────────────────────────
export async function saveBilling(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  const billingModel = String(fd.get('billing_model') ?? 'per_booking')
  if (!isBillingModel(billingModel)) return { error: 'Ogiltig prismodell.' }
  const setupFee = kronorToCents(String(fd.get('setup_fee') ?? '')) ?? 0
  const perBookingFee = kronorToCents(String(fd.get('per_booking_fee') ?? '')) ?? 0
  const flatMonthlyFee = kronorToCents(String(fd.get('flat_monthly_fee') ?? '')) ?? 0

  const { error } = await supabase.rpc('platform_save_tenant_billing', {
    p_tenant: tenantId,
    p_billing_model: billingModel,
    p_setup_fee_cents: setupFee,
    p_per_booking_fee_cents: perBookingFee,
    p_flat_monthly_fee_cents: flatMonthlyFee,
  })
  if (error) {
    await reportActionError('saveBilling.rpc', error, { tenantId })
    return { error: GENERIC }
  }

  revalidatePath(`/kunder/${tenantId}`)
  revalidatePath('/fakturering')
  return { success: 'Prismodell sparad.' }
}
