import 'server-only'

import Stripe from 'stripe'
import { createServiceClient } from '@/lib/platform/service'
import type { StripeBillingReconcileJob } from '@/lib/jobs/generic-jobs'

export const PLATFORM_BILLING_MODES = ['off', 'test', 'draft'] as const
export type PlatformBillingMode = (typeof PLATFORM_BILLING_MODES)[number]

const clients = new Map<string, Stripe>()

export function getPlatformBillingMode(): PlatformBillingMode {
  const value = process.env.STRIPE_PLATFORM_BILLING_MODE
  return value === 'test' || value === 'draft' ? value : 'off'
}

export function getPlatformBillingStripe(livemode?: boolean): Stripe | null {
  const mode = getPlatformBillingMode()
  const useLive = livemode ?? (mode === 'draft' ? true : mode === 'test' ? false : null)
  if (useLive === null) return null
  const key = (useLive
    ? process.env.STRIPE_PLATFORM_BILLING_LIVE_SECRET_KEY
    : process.env.STRIPE_PLATFORM_BILLING_TEST_SECRET_KEY)
    ?? process.env.STRIPE_PLATFORM_BILLING_SECRET_KEY
  if (!key || !key.startsWith(useLive ? 'sk_live_' : 'sk_test_')) return null
  if (!clients.has(key)) {
    clients.set(key, new Stripe(key, {
      apiVersion: '2026-05-27.dahlia',
      httpClient: Stripe.createFetchHttpClient(),
    }))
  }
  return clients.get(key) ?? null
}

export function getPlatformBillingWebhookSecret(): string | null {
  return process.env.STRIPE_PLATFORM_BILLING_WEBHOOK_SECRET ?? null
}

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

async function serviceRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const service = createServiceClient() as unknown as RpcClient | null
  if (!service) throw new Error('platform_billing_service_unavailable')
  const result = await service.rpc(name, args)
  if (result.error) throw new Error(`platform_billing_${name}_failed`)
  return result.data
}

function customerId(invoice: Stripe.Invoice): string | null {
  if (typeof invoice.customer === 'string') return invoice.customer
  return invoice.customer?.id ?? null
}

function invoiceStatus(invoice: Stripe.Invoice): NonNullable<Stripe.Invoice.Status> {
  if (!invoice.status) throw new Error('platform_billing_invoice_status_missing')
  return invoice.status
}

function billingEvent(value: unknown): {
  eventType: string
  objectId: string
  livemode: boolean
} {
  if (
    typeof value !== 'object'
    || value === null
    || !('eventType' in value)
    || typeof value.eventType !== 'string'
    || !('objectId' in value)
    || typeof value.objectId !== 'string'
    || !('livemode' in value)
    || typeof value.livemode !== 'boolean'
  ) throw new Error('platform_billing_event_invalid')
  return value as { eventType: string; objectId: string; livemode: boolean }
}

async function attach(args: {
  periodId: string
  customerId: string
  invoiceId?: string | null
  status?: Stripe.Invoice.Status | null
  livemode: boolean
}) {
  const attached = await serviceRpc('attach_platform_billing_draft', {
    p_period: args.periodId,
    p_customer_id: args.customerId,
    p_invoice_id: args.invoiceId ?? null,
    p_invoice_status: args.status ?? null,
    p_livemode: args.livemode,
  })
  if (attached !== true) throw new Error('platform_billing_attach_failed')
}

export async function markPlatformBillingError(periodId: string, code: string): Promise<void> {
  try {
    await serviceRpc('mark_platform_billing_error', {
      p_period: periodId,
      p_error_code: code,
    })
  } catch {
    // The provider error remains observable even if this secondary marker fails.
  }
}

export async function createPlatformBillingDraft(args: {
  periodId: string
  tenantId: string
  tenantName: string
  orgNr: string | null
  periodStart: string
  periodEnd: string
  totalCents: number
  currency: string
  existingCustomerId: string | null
  existingInvoiceId: string | null
}): Promise<{ invoiceId: string; status: string; livemode: boolean }> {
  const mode = getPlatformBillingMode()
  const stripe = getPlatformBillingStripe()
  if (!stripe || mode === 'off') throw new Error('platform_billing_disabled')
  const livemode = mode === 'draft'
  let customer = args.existingCustomerId

  if (customer) {
    const current = await stripe.customers.retrieve(customer)
    if ('deleted' in current && current.deleted) customer = null
  }
  if (!customer) {
    const created = await stripe.customers.create(
      { name: args.tenantName, metadata: { corevo_tenant_id: args.tenantId } },
      { idempotencyKey: `corevo:billing:customer:${mode}:${args.tenantId}:${args.periodStart}` },
    )
    if (created.livemode !== livemode) throw new Error('platform_billing_mode_mismatch')
    customer = created.id
    await attach({ periodId: args.periodId, customerId: customer, livemode })
  }

  let invoice = args.existingInvoiceId
    ? await stripe.invoices.retrieve(args.existingInvoiceId)
    : null

  if (!invoice) {
    invoice = await stripe.invoices.create(
      {
        customer,
        currency: args.currency,
        auto_advance: false,
        collection_method: 'send_invoice',
        days_until_due: 30,
        pending_invoice_items_behavior: 'exclude',
        description: `Corevo plattformsavgift ${args.periodStart.slice(0, 7)}`,
        custom_fields: args.orgNr ? [{ name: 'Org.nr', value: args.orgNr }] : undefined,
        metadata: {
          corevo_tenant_id: args.tenantId,
          corevo_period_start: args.periodStart,
        },
      },
      { idempotencyKey: `corevo:billing:invoice:${mode}:${args.tenantId}:${args.periodStart}` },
    )
    if (invoice.livemode !== livemode) throw new Error('platform_billing_mode_mismatch')
  }

  if (invoice.livemode !== livemode || customerId(invoice) !== customer) {
    throw new Error('platform_billing_invoice_identity_mismatch')
  }
  if (invoice.total === 0) {
    await stripe.invoiceItems.create(
      {
        customer,
        invoice: invoice.id,
        amount: args.totalCents,
        currency: args.currency,
        discountable: false,
        description: `Corevo plattformsavgift ${args.periodStart.slice(0, 7)}`,
        period: {
          start: Math.floor(Date.parse(`${args.periodStart}T00:00:00Z`) / 1000),
          end: Math.floor(Date.parse(`${args.periodEnd}T00:00:00Z`) / 1000) - 1,
        },
        metadata: {
          corevo_tenant_id: args.tenantId,
          corevo_period_start: args.periodStart,
        },
      },
      { idempotencyKey: `corevo:billing:item:${mode}:${args.tenantId}:${args.periodStart}` },
    )
    invoice = await stripe.invoices.retrieve(invoice.id)
  }
  if (invoice.total !== args.totalCents) throw new Error('platform_billing_amount_mismatch')
  const status = invoiceStatus(invoice)
  await attach({
    periodId: args.periodId,
    customerId: customer,
    invoiceId: invoice.id,
    status,
    livemode,
  })
  return { invoiceId: invoice.id, status, livemode }
}

export async function reconcilePlatformBillingJob(
  job: StripeBillingReconcileJob,
): Promise<void> {
  const event = billingEvent(await serviceRpc('platform_billing_webhook_event', {
    p_event_id: job.eventId,
  }))
  if (event.objectId !== job.objectId) throw new Error('platform_billing_event_mismatch')
  if (event.eventType === 'invoice.deleted') {
    const reconciled = await serviceRpc('reconcile_platform_billing_invoice', {
      p_invoice_id: event.objectId,
      p_customer_id: null,
      p_invoice_status: 'deleted',
      p_livemode: event.livemode,
      p_total_cents: null,
    })
    if (reconciled !== true) throw new Error('platform_billing_reconcile_mismatch')
    return
  }
  const stripe = getPlatformBillingStripe(event.livemode)
  if (!stripe) throw new Error('platform_billing_event_client_unavailable')
  const invoice = await stripe.invoices.retrieve(job.objectId)
  if (invoice.livemode !== event.livemode) throw new Error('platform_billing_mode_mismatch')
  const customer = customerId(invoice)
  if (!customer) throw new Error('platform_billing_customer_missing')
  const currentCustomer = await stripe.customers.retrieve(customer)
  if ('deleted' in currentCustomer && currentCustomer.deleted) {
    throw new Error('platform_billing_customer_deleted')
  }
  const reconciled = await serviceRpc('reconcile_platform_billing_invoice', {
    p_invoice_id: invoice.id,
    p_customer_id: customer,
    p_invoice_status: invoiceStatus(invoice),
    p_livemode: invoice.livemode,
    p_total_cents: invoice.total,
  })
  if (reconciled !== true) throw new Error('platform_billing_reconcile_mismatch')
}
