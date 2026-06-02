import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { accentForeground } from '@corevo/ui'
import { sendEmail } from './email'
import { shell, type EmailBrandFields } from './templates'
import { logger } from '@/lib/observability'
import { getEnabledNotifications, getGoogleReviewUrl } from './settings'
import { parseGuestEmail, parseGuestName } from './parse'

// Google-review NUDGE (M9). Designed to fire AFTER a visit (booking status =
// 'completed'): a short, warm Swedish email asking the happy customer to leave a
// Google review. EXPORTED but intentionally NOT wired into any action/route — the
// orchestrator picks the call site (e.g. a "mark completed" action or a cron sweep
// over completed bookings). See docs/notifications-architecture.md for timing.
//
// Best-effort + graceful no-op, mirroring the rest of lib/notifications:
//   · no reviewUrl  → skip (owner hasn't set settings.google_review_url)
//   · no recipient  → skip
//   · review nudge disabled (settings.notifications.review=false) → caller skips
//     it via getEnabledNotifications (consulted at the call site, not here)
// It never throws into the caller; a mail hiccup must never break the visit flow.

// Inline-only brand mirror (email clients ignore CSS vars / web fonts) — kept in
// sync with templates.ts; the shared shell() carries the rest of the chrome.
const GOLD = '#F5A623'
const INK = '#0E1411'
const SANS = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

/** Resolve a salon accent into a {bg, legible-fg} pair (mirrors templates.ts). */
function resolveAccent(accentColor?: string | null): { accent: string; accentFg: string } {
  const raw = accentColor?.trim()
  const accent = raw && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : GOLD
  return { accent, accentFg: accentForeground(accent) ?? INK }
}

export type GoogleReviewData = {
  tenantName: string
  /** Owner's Google review link (from settings.google_review_url). No-op if empty. */
  reviewUrl: string | null | undefined
  /** Optional first name for a warmer greeting ("Hej Anna,"). */
  customerName?: string | null
  /** Per-salon brand (goal-14) — accent/logo/slogan for the shell + CTA. */
  brand?: EmailBrandFields
  /** From display string ("<Salong>" <bokning@corevo.se>); default platform sender. */
  from?: string
  /** Reply-To (salon inbox); omitted when absent. */
  replyTo?: string
}

export function googleReviewEmail(d: {
  tenantName: string
  reviewUrl: string
  customerName?: string | null
  brand?: EmailBrandFields
}): { subject: string; html: string } {
  const hej = d.customerName ? `Hej ${escapeText(d.customerName)},` : 'Hej,'
  const { accent, accentFg } = resolveAccent(d.brand?.accentColor)
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px">
    <tr><td style="border-radius:9999px;background:${accent}">
      <a href="${escapeAttr(d.reviewUrl)}" style="display:inline-block;padding:13px 28px;font-family:${SANS};font-size:15px;font-weight:700;color:${accentFg};text-decoration:none;border-radius:9999px">Lämna ett omdöme</a>
    </td></tr>
  </table>`
  return {
    subject: `Hur var ditt besök hos ${d.tenantName}?`,
    html: shell(
      'Vi hoppas du trivdes',
      `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">${hej}</p>
       <p style="margin:0 0 8px;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">Tack för ditt besök! Om du blev nöjd skulle vi bli jätteglada om du tog en stund och lämnade ett omdöme på Google — det hjälper oss enormt och tar bara en minut.</p>
       ${button}
       <p style="margin:14px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:#677E73">Tack på förhand, och varmt välkommen åter!</p>`,
      d.tenantName,
      'Berätta gärna',
      d.brand,
    ),
  }
}

/**
 * Send a Google-review nudge. No-op (returns { ok:false, skipped:true }) when the
 * tenant has no review URL configured, so it is safe to call unconditionally after
 * a completed visit. Never throws.
 */
export async function sendGoogleReviewNudge(
  to: string | null | undefined,
  d: GoogleReviewData,
): Promise<{ ok: boolean; skipped?: true; error?: string }> {
  const reviewUrl = d.reviewUrl?.trim()
  if (!reviewUrl) {
    logger.info('review.skipped_no_url', { tenant: d.tenantName })
    return { ok: false, skipped: true }
  }
  if (!to) {
    logger.info('review.skipped_no_recipient', { tenant: d.tenantName })
    return { ok: false, skipped: true }
  }

  const mail = googleReviewEmail({
    tenantName: d.tenantName,
    reviewUrl,
    customerName: d.customerName,
  })
  const res = await sendEmail({ to, subject: mail.subject, html: mail.html })
  if (res.ok) {
    logger.info('review.sent', { tenant: d.tenantName, to })
    return { ok: true }
  }
  if (res.skipped) return { ok: false, skipped: true }
  logger.warn('review.failed', { tenant: d.tenantName, to, error: res.error })
  return { ok: false, error: res.error }
}

type ReviewBookingRow = {
  tenant_id: string
  note: string | null
  customer_profile_id: string | null
  tenants: { name?: string } | null
}

/**
 * Fire a Google-review nudge for a booking that JUST transitioned to `completed`
 * (wired into the personal + admin setBookingStatus actions). STRICTLY best-effort:
 * every failure — query, settings read, transport — is swallowed so the status
 * update that triggered it always succeeds. Gated on the owner's `review` toggle
 * and a configured review URL; both no-op gracefully when unset.
 *
 * Recipient resolution mirrors the reminder pipeline: the guest-note seam first
 * (covers public storefront bookings), then the linked customer's users.email.
 * The latter may be invisible to a tenant-scoped client under RLS — in that case
 * the nudge simply no-ops, which is acceptable for a best-effort channel.
 *
 * Caller MUST have already verified ownership of `bookingId` (i.e. only call after
 * a successful tenant-scoped status update), since this only reads it back.
 */
export async function sendReviewNudgeForBooking(
  supabase: SupabaseClient<Database>,
  bookingId: string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from('bookings')
      .select('tenant_id, note, customer_profile_id, tenants(name)')
      .eq('id', bookingId)
      .maybeSingle()
    const b = data as unknown as ReviewBookingRow | null
    if (!b) return

    const prefs = await getEnabledNotifications(supabase, b.tenant_id)
    if (!prefs.review) return
    const reviewUrl = await getGoogleReviewUrl(supabase, b.tenant_id)
    if (!reviewUrl) return

    let to = parseGuestEmail(b.note)
    if (!to && b.customer_profile_id) {
      const { data: u } = await supabase
        .from('users')
        .select('email')
        .eq('id', b.customer_profile_id)
        .maybeSingle()
      to = u?.email ?? null
    }
    if (!to) return

    await sendGoogleReviewNudge(to, {
      tenantName: b.tenants?.name ?? 'Salongen',
      reviewUrl,
      customerName: parseGuestName(b.note),
    })
  } catch (err) {
    logger.warn('review.nudge_failed', {
      bookingId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// Local escapers (google-review keeps its own small body strings; templates.ts'
// esc() is module-private, so we don't reach across files).
function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}
function escapeAttr(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}
