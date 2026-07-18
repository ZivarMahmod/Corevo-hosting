'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { isBillingModel, kronorToCents } from '../billing'
import { logPlatformAction } from '../audit'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── FLÖDE 2: billing model + fees ───────────────────────────────────────────────
export async function saveBilling(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  const billingModel = String(fd.get('billing_model') ?? 'per_booking')
  if (!isBillingModel(billingModel)) return { error: 'Ogiltig prismodell.' }
  const setupFee = kronorToCents(String(fd.get('setup_fee') ?? '')) ?? 0
  const perBookingFee = kronorToCents(String(fd.get('per_booking_fee') ?? '')) ?? 0
  const flatMonthlyFee = kronorToCents(String(fd.get('flat_monthly_fee') ?? '')) ?? 0

  const { error } = await supabase.from('tenant_settings').upsert(
    {
      tenant_id: tenantId,
      billing_model: billingModel,
      setup_fee_cents: setupFee,
      per_booking_fee_cents: perBookingFee,
      flat_monthly_fee_cents: flatMonthlyFee,
    },
    { onConflict: 'tenant_id' },
  )
  if (error) {
    await reportActionError('saveBilling.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidatePath(`/kunder/${tenantId}`)
  revalidatePath('/fakturering')
  await logPlatformAction(supabase, {
    action: 'tenant.billing',
    tenantId,
    actorId: user.id,
    meta: { billing_model: billingModel },
  })
  return { success: 'Prismodell sparad.' }
}
