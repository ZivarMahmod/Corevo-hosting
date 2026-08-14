'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { platformAdminCtx, platformCtx } from '../guard'
import { isBillingModel, isClosedBillingPeriod, kronorToCents } from '../billing'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'
import { billingUnderlag } from '../metrics'
import {
  createPlatformBillingDraft,
  getPlatformBillingMode,
  markPlatformBillingError,
} from '@/lib/stripe/platform-billing'

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

const draftInput = z.object({
  tenantId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

function periodDates(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export async function createBillingDraft(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const input = draftInput.safeParse({
    tenantId: fd.get('tenantId'),
    year: fd.get('year'),
    month: fd.get('month'),
  })
  if (!input.success) return { error: 'Ogiltigt faktureringsunderlag.' }
  const { supabase } = await platformAdminCtx()
  const mode = getPlatformBillingMode()
  if (mode === 'off') return { error: 'Stripe-fakturering är avstängd i driftmiljön.' }

  const { tenantId, year, month } = input.data
  if (!isClosedBillingPeriod(year, month)) {
    return { error: 'Fakturautkast kan bara skapas för en avslutad månad.' }
  }
  const row = (await billingUnderlag(year, month)).rows.find((candidate) => (
    candidate.tenantId === tenantId
  ))
  if (!row) return { error: 'Kunden finns inte i faktureringsunderlaget.' }
  const dates = periodDates(year, month)
  const retryErrorCode = mode === 'test' ? 'test_draft_failed' : 'live_draft_failed'
  type BillingPeriod = {
    id: string
    total_cents: number
    currency: string
    stripe_test_customer_id: string | null
    stripe_test_invoice_id: string | null
    stripe_test_invoice_status: string | null
    stripe_customer_id: string | null
    stripe_invoice_id: string | null
    stripe_invoice_status: string | null
    last_error_code: string | null
  }
  const existing = await supabase.rpc('platform_billing_period', {
    p_tenant: tenantId,
    p_period_start: dates.start,
  })
  if (existing.error) {
    await reportActionError('createBillingDraft.period', existing.error, { tenantId })
    return { error: 'Periodens fakturasanning kunde inte läsas.' }
  }

  let period = (existing.data as BillingPeriod[] | null)?.[0]
  const currentInvoiceId = mode === 'test'
    ? period?.stripe_test_invoice_id
    : period?.stripe_invoice_id
  const currentInvoiceStatus = mode === 'test'
    ? period?.stripe_test_invoice_status
    : period?.stripe_invoice_status
  if (
    currentInvoiceId
    && (currentInvoiceStatus !== 'draft' || period?.last_error_code !== retryErrorCode)
  ) {
    return { error: 'Ett Stripe-utkast finns redan för perioden.' }
  }

  if (!period) {
    if (row.feeCents <= 0) return { error: 'Underlaget är 0 kr och kan inte faktureras.' }
    const unitAmount = row.billingModel === 'flat_monthly'
      ? row.flatMonthlyFeeCents
      : row.perBookingFeeCents
    const reserved = await supabase.rpc('reserve_platform_billing_period', {
      p_tenant: tenantId,
      p_period_start: dates.start,
      p_billing_model: row.billingModel,
      p_completed_bookings: row.completedBookings,
      p_unit_amount_cents: unitAmount,
      p_total_cents: row.feeCents,
      p_currency: 'sek',
    })
    const locked = (reserved.data as Omit<
      BillingPeriod,
      'total_cents' | 'currency' | 'last_error_code'
    >[] | null)?.[0]
    if (reserved.error || !locked) {
      await reportActionError('createBillingDraft.reserve', reserved.error ?? new Error('missing period'), {
        tenantId,
      })
      return { error: 'Periodens fakturasanning kunde inte låsas.' }
    }
    period = { ...locked, total_cents: row.feeCents, currency: 'sek', last_error_code: null }
  }

  if (!period) {
    await reportActionError('createBillingDraft.period', new Error('missing period'), {
      tenantId,
    })
    return { error: 'Periodens fakturasanning kunde inte läsas.' }
  }

  try {
    const result = await createPlatformBillingDraft({
      periodId: period.id,
      tenantId,
      tenantName: row.name,
      orgNr: row.orgNr,
      periodStart: dates.start,
      periodEnd: dates.end,
      totalCents: period.total_cents,
      currency: period.currency,
      existingCustomerId: mode === 'test'
        ? period.stripe_test_customer_id
        : period.stripe_customer_id,
      existingInvoiceId: mode === 'test'
        ? period.stripe_test_invoice_id
        : period.stripe_invoice_id,
    })
    revalidatePath('/fakturering')
    return {
      success: `${mode === 'test' ? 'Testutkast' : 'Fakturautkast'} ${result.invoiceId} är ${result.status}.`,
    }
  } catch (caught) {
    await markPlatformBillingError(period.id, retryErrorCode)
    await reportActionError('createBillingDraft.stripe', caught, { tenantId, mode })
    return caught instanceof Error && caught.message === 'platform_billing_amount_mismatch'
      ? { error: 'Stripe-utkastets belopp matchar inte det låsta underlaget.' }
      : { error: 'Fakturautkastet kunde inte skapas. Ingen faktura har finaliserats.' }
  }
}
