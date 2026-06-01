import 'server-only'
import { createServiceClient } from '@/lib/platform/service'
import { logger } from '@/lib/observability'

// GDPR erasure (G10 step 2 — "rätten att bli glömd"). Requires service-role (it
// deletes the auth user + writes across rows RLS would not allow); degrades to
// { unavailable } when SUPABASE_SERVICE_ROLE_KEY is unset (mirrors signup/invite).
//
// Retention policy (deliberate, see docs/ops/backup-restore.md §GDPR):
//   · bookings  → ANONYMIZED, not deleted. Scrub the note free-text (the guest-PII
//                 seam) and null customer_profile_id, but KEEP the row so the salon
//                 keeps an intact schedule/financial history.
//   · payments  → KEPT untouched. Swedish Bokföringslagen requires ~7-year
//                 retention; the rows carry no direct PII (linked by booking_id).
//   · users + auth.users → DELETED (cascade). This removes name/email/phone.
//   · audit_log → an erasure record is appended, but it is append-only and MUST
//                 NOT carry PII: we log the user id + a booking count only.

export type EraseResult =
  | { ok: true; erasedBookings: number }
  | { ok: false; reason: 'unavailable' | 'error' }

export async function eraseCustomerData(args: {
  userId: string
  tenantId: string
  actorId: string
}): Promise<EraseResult> {
  const { userId, tenantId, actorId } = args
  if (!userId || !tenantId) return { ok: false, reason: 'error' }

  const admin = createServiceClient()
  if (!admin) {
    logger.warn('gdpr.erase.unavailable (no service role)', { userId })
    return { ok: false, reason: 'unavailable' }
  }

  try {
    // 1. Anonymize bookings: drop the PII note + unlink the customer, keep the row.
    const { data: scrubbed, error: bErr } = await admin
      .from('bookings')
      .update({ customer_profile_id: null, note: null })
      .eq('customer_profile_id', userId)
      .eq('tenant_id', tenantId)
      .select('id')
    if (bErr) {
      logger.warn('gdpr.erase.bookings_failed', { userId, error: bErr.message })
      return { ok: false, reason: 'error' }
    }
    const erasedBookings = scrubbed?.length ?? 0

    // 2. Append a PII-FREE audit record (audit_log is append-only — never put
    //    name/email here, it can never be scrubbed back out).
    await admin.from('audit_log').insert({
      tenant_id: tenantId,
      actor_profile_id: actorId,
      action: 'gdpr.erase',
      entity: 'user',
      entity_id: userId,
      meta: { erased_bookings: erasedBookings } as never,
    })

    // 3. Delete the auth user → cascades public.users (FK on delete cascade).
    const { error: dErr } = await admin.auth.admin.deleteUser(userId)
    if (dErr) {
      logger.warn('gdpr.erase.auth_delete_failed', { userId, error: dErr.message })
      return { ok: false, reason: 'error' }
    }

    logger.info('gdpr.erase.done', { userId, erasedBookings })
    return { ok: true, erasedBookings }
  } catch (e) {
    logger.error('gdpr.erase.threw', { userId, error: e instanceof Error ? e.message : String(e) })
    return { ok: false, reason: 'error' }
  }
}
