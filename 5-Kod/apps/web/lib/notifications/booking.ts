import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { sendEmail, buildFrom, type SendResult } from './email'
import { logger } from '@/lib/observability'
import { loadEmailBrand } from './brand'
import {
  receiptEmail,
  type BookingEmailData,
} from './templates'

// Tenant context for resolving per-salon email brand (From name, Reply-To, accent,
// logo, slogan). When ABSENT, senders still set the From display name from
// d.tenantName but send no Reply-To and no brand — fully backwards-compatible.
export type BrandCtx = { supabase: SupabaseClient<Database>; tenantId: string }

/**
 * Fold per-salon brand into the email data + From/Reply-To. With no ctx, degrades
 * to the salon name as From display (no Reply-To, Corevo-gold template). Best-effort:
 * a brand-load failure is swallowed inside loadEmailBrand, never blocks the send.
 */
async function applyBrand(
  d: BookingEmailData,
  ctx?: BrandCtx,
): Promise<{ data: BookingEmailData; from?: string; replyTo?: string }> {
  if (!ctx?.supabase || !ctx.tenantId) {
    return { data: d, from: buildFrom(d.tenantName) }
  }
  const brand = await loadEmailBrand(ctx.supabase, ctx.tenantId, d.tenantName)
  return {
    data: { ...d, accentColor: brand.accentColor, logoUrl: brand.logoUrl, slogan: brand.slogan },
    from: brand.from,
    replyTo: brand.replyTo,
  }
}

// Guest-note parsers live in ./parse (pure, unit-tested); re-exported here so
// payment-webhook callers keep their stable import path.
export { parseGuestEmail, parseGuestName } from './parse'

async function safeSend(
  kind: string,
  to: string | null | undefined,
  mail: { subject: string; html: string },
  opts?: { from?: string; replyTo?: string },
): Promise<SendResult> {
  if (!to) {
    logger.info('notify.skipped_no_recipient', { kind })
    return { ok: false, error: 'missing_recipient' }
  }
  const res = await sendEmail({ to, subject: mail.subject, html: mail.html, from: opts?.from, replyTo: opts?.replyTo })
  if (res.ok) logger.info('notify.sent', { kind })
  else if (!res.skipped) logger.warn('notify.failed', { kind, error: res.error })
  return res
}

export async function sendPaymentReceipt(
  to: string | null,
  d: BookingEmailData & {
    amountCents: number
    currency: string
    /** Plan 003: org-nr + momssats (settings.legal) — utelämnade → kvittot utan raderna. */
    orgNr?: string | null
    vatRate?: number | null
  },
  ctx?: BrandCtx,
): Promise<void> {
  const { data, from, replyTo } = await applyBrand(d, ctx)
  await safeSend(
    'payment.receipt',
    to,
    receiptEmail({
      ...data,
      amountCents: d.amountCents,
      currency: d.currency,
      orgNr: d.orgNr,
      vatRate: d.vatRate,
    }),
    { from, replyTo },
  )
}
