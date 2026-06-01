import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

// Owner-controlled notification settings (M9). There is no dedicated column this
// wave (schema is shared/frozen), so — exactly like lib/kund/settings.ts'
// getCancellationCutoffHours — these live in `tenant_settings.settings` (jsonb)
// and are read app-side with safe defaults.
//
// Read-only here. These are EXPORTED so senders / call sites can consult them, but
// they are deliberately NOT wired into the send path: the existing senders take
// (to, data) with no tenantId/client, and adding a settings lookup there would
// force a signature change + caller edits (out of revir). The orchestrator wires
// the consult at the call sites. See docs/notifications-architecture.md.

/** Toggle map under `settings.notifications`. All channels default to ON. */
export type NotificationPrefs = {
  confirmation: boolean
  reminder: boolean
  review: boolean
}

/** Safe default: every owner-toggleable notification is enabled until turned off. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  confirmation: true,
  reminder: true,
  review: true,
}

/** Coerce an unknown jsonb value to a boolean, defaulting to ON when absent. */
function flag(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (v === 'false' || v === 0) return false
  if (v == null) return true
  return Boolean(v)
}

/**
 * Which owner-toggleable notifications are enabled for this tenant. Reads
 * `tenant_settings.settings.notifications.{confirmation,reminder,review}`,
 * defaulting EVERYTHING to true (so an unconfigured salon keeps full service).
 *
 * Gates only these three categories on purpose — receipts and cancellation
 * confirmations are transactional/legal and are never suppressed.
 */
export async function getEnabledNotifications(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<NotificationPrefs> {
  if (!tenantId) return { ...DEFAULT_NOTIFICATION_PREFS }

  const { data } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const settings = (data?.settings ?? {}) as Record<string, unknown>
  const n = settings.notifications
  if (!n || typeof n !== 'object' || Array.isArray(n)) {
    return { ...DEFAULT_NOTIFICATION_PREFS }
  }
  const prefs = n as Record<string, unknown>
  return {
    confirmation: flag(prefs.confirmation),
    reminder: flag(prefs.reminder),
    review: flag(prefs.review),
  }
}

/**
 * Whether the owner has opted INTO SMS notifications for this tenant. Reads
 * `tenant_settings.settings.sms_enabled`, defaulting to FALSE — SMS is opt-in
 * (a paid/secondary channel), the opposite default from the email toggles above,
 * so the coercion is written explicitly rather than via flag().
 */
export async function getSmsEnabled(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<boolean> {
  if (!tenantId) return false

  const { data } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const settings = (data?.settings ?? {}) as Record<string, unknown>
  return settings.sms_enabled === true
}

/**
 * The tenant's Google-review URL (e.g. a Google Place review link), or null if
 * the owner hasn't set one. Read from `tenant_settings.settings.google_review_url`.
 * A null result means the review nudge is a graceful no-op (see google-review.ts).
 */
export async function getGoogleReviewUrl(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<string | null> {
  if (!tenantId) return null

  const { data } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const settings = (data?.settings ?? {}) as Record<string, unknown>
  const raw = settings.google_review_url
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  if (!url || !/^https?:\/\//i.test(url)) return null
  return url
}
