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
//   · customers  → ANONYMIZED across ALL tenants (white-label: one auth user may
//                 be a customer in several salons). PII columns nulled + status
//                 flipped to 'anonymized', which fires the scrub trigger that
//                 DELETEs the internal customer_notes (right-to-be-forgotten).
//   · customer_favorites → DELETED (personal data, no retention basis).
//   · loyalty_ledger → KEPT untouched (append-only + PII-free: points + booking_id).
//   · users + auth.users → DELETED (cascade). This removes name/email/phone.
//   · audit_log → an erasure record is appended, but it is append-only and MUST
//                 NOT carry PII: we log the user id + counts only.

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
    // 1. Look up the user's own contact so we can also reach UNLINKED guest
    //    customer rows that share it (a person who booked as guest, then later
    //    registered — the merge case the schema anticipates, 0011). Best-effort.
    const { data: userRow } = await admin
      .from('users')
      .select('email, phone')
      .eq('id', userId)
      .maybeSingle()
    const userEmail = userRow?.email?.trim() || null

    // 2. Anonymize the customer identity ACROSS ALL TENANTS (white-label: one
    //    person may be a customer in several salons). Reached two ways:
    //      (a) auth_user_id = userId → rows linked to the logged-in account
    //      (b) email = userEmail     → unlinked guest rows sharing the contact
    //    Flipping status -> 'anonymized' fires trg_customers_anonymize_scrub_notes,
    //    which DELETEs the internal customer_notes. PII columns nulled directly.
    const anonPatch = {
      full_name: null,
      email: null,
      phone: null,
      contact_hash: null,
      display_name: null,
      status: 'anonymized',
    }
    const customerIds = new Set<string>()
    {
      const { data, error } = await admin
        .from('customers')
        .update(anonPatch)
        .eq('auth_user_id', userId)
        .select('id')
      if (error) {
        logger.warn('gdpr.erase.customers_failed', { userId, error: error.message })
        return { ok: false, reason: 'error' }
      }
      for (const c of data ?? []) customerIds.add(c.id)
    }
    if (userEmail) {
      const { data, error } = await admin
        .from('customers')
        .update(anonPatch)
        .ilike('email', userEmail)
        .eq('status', 'active')
        .select('id')
      if (error) {
        logger.warn('gdpr.erase.customers_email_failed', { userId, error: error.message })
        return { ok: false, reason: 'error' }
      }
      for (const c of data ?? []) customerIds.add(c.id)
    }
    const ids = [...customerIds]
    const anonymizedCustomers = ids.length

    // 3. Delete favorites for the anonymized customers (personal data, no
    //    retention basis). loyalty_ledger is KEPT (append-only + PII-free);
    //    customer_notes were already scrubbed by the status trigger above.
    if (ids.length > 0) {
      const { error: fErr } = await admin
        .from('customer_favorites')
        .delete()
        .in('customer_id', ids)
      if (fErr) {
        logger.warn('gdpr.erase.favorites_failed', { userId, error: fErr.message })
        return { ok: false, reason: 'error' }
      }
    }

    // 4. Anonymize bookings ACROSS ALL TENANTS — drop the PII note + unlink,
    //    keep the row (schedule/financial history). Reached two ways:
    //      (a) customer_profile_id = userId → the logged-in account's bookings
    //      (b) customer_id IN (anonymized)  → guest bookings linked by the 0011
    //          backfill, whose note carries the guest-PII seam.
    //    Not tenant-scoped: erasure is global. (customer_profile_id has no FK, so
    //    deleting the auth user would otherwise leave a dangling id behind, 0001.)
    let erasedBookings = 0
    {
      const { data, error } = await admin
        .from('bookings')
        .update({ customer_profile_id: null, note: null })
        .eq('customer_profile_id', userId)
        .select('id')
      if (error) {
        logger.warn('gdpr.erase.bookings_failed', { userId, error: error.message })
        return { ok: false, reason: 'error' }
      }
      erasedBookings += data?.length ?? 0
    }
    if (ids.length > 0) {
      const { data, error } = await admin
        .from('bookings')
        .update({ note: null })
        .in('customer_id', ids)
        .not('note', 'is', null)
        .select('id')
      if (error) {
        logger.warn('gdpr.erase.bookings_notes_failed', { userId, error: error.message })
        return { ok: false, reason: 'error' }
      }
      erasedBookings += data?.length ?? 0
    }

    // 2. Append a PII-FREE audit record (audit_log is append-only — never put
    //    name/email here, it can never be scrubbed back out).
    await admin.from('audit_log').insert({
      tenant_id: tenantId,
      actor_profile_id: actorId,
      action: 'gdpr.erase',
      entity: 'user',
      entity_id: userId,
      meta: { erased_bookings: erasedBookings, anonymized_customers: anonymizedCustomers } as never,
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

/**
 * ÄGAR-INITIERAD radering (plan 007, art. 17 via salongen): TENANT-SCOPAD variant.
 * Skillnader mot eraseCustomerData (kundens självbetjäning) är avsiktliga:
 *   · Nyckeln är CUSTOMER_ID (kundkortet) — de flesta salongskunder är gäster utan
 *     auth-konto, så en userId-nyckel hade inte nått dem.
 *   · Endast DENNA tenants rader röres. En ägare har inget mandat över samma persons
 *     data hos andra salonger (white-label) — cross-tenant-radering är kundens egen
 *     självbetjäningsväg (eller ett framtida plattformsverktyg, medvetet uppskjutet).
 *   · auth-användaren raderas ALDRIG här (kontot kan bära andra salongers relationer).
 * Samma retention-policy i övrigt: bokningar anonymiseras (aldrig raderas),
 * betalningar orörda (bokföringslagen), favorites raderas, audit får en PII-fri rad.
 */
export async function eraseTenantCustomerData(args: {
  customerId: string
  tenantId: string
  actorId: string
}): Promise<EraseResult> {
  const { customerId, tenantId, actorId } = args
  if (!customerId || !tenantId) return { ok: false, reason: 'error' }

  const admin = createServiceClient()
  if (!admin) {
    logger.warn('gdpr.tenant_erase.unavailable (no service role)', { customerId })
    return { ok: false, reason: 'unavailable' }
  }

  try {
    // 1. Tenant-fence FÖRST: kortet måste tillhöra ägarens tenant. Service-rollen
    //    ser allt, så vakten bor här — aldrig i klientens ord.
    const { data: customer } = await admin
      .from('customers')
      .select('id, auth_user_id, status')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!customer) return { ok: false, reason: 'error' }

    // 2. Anonymisera kortet (status → 'anonymized' triggar customer_notes-scrubben).
    const { error: cErr } = await admin
      .from('customers')
      .update({
        full_name: null,
        email: null,
        phone: null,
        contact_hash: null,
        display_name: null,
        status: 'anonymized',
      })
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
    if (cErr) {
      logger.warn('gdpr.tenant_erase.customer_failed', { customerId, error: cErr.message })
      return { ok: false, reason: 'error' }
    }

    // 3. Favoriter = persondata utan retention-grund → radera.
    const { error: fErr } = await admin
      .from('customer_favorites')
      .delete()
      .eq('customer_id', customerId)
    if (fErr) {
      logger.warn('gdpr.tenant_erase.favorites_failed', { customerId, error: fErr.message })
      return { ok: false, reason: 'error' }
    }

    // 4. Bokningar i DENNA tenant: scrubba PII-noten + släpp auth-länken, behåll
    //    raden (schema-/ekonomihistorik). loyalty_ledger orörd (append-only, PII-fri).
    const { data: bookingRows, error: bErr } = await admin
      .from('bookings')
      .update({ note: null, customer_profile_id: null })
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .select('id')
    if (bErr) {
      logger.warn('gdpr.tenant_erase.bookings_failed', { customerId, error: bErr.message })
      return { ok: false, reason: 'error' }
    }
    const erasedBookings = bookingRows?.length ?? 0

    // 5. PII-FRI audit-rad (append-only — id + antal, aldrig namn/mejl).
    await admin.from('audit_log').insert({
      tenant_id: tenantId,
      actor_profile_id: actorId,
      action: 'gdpr.tenant_erase',
      entity: 'customer',
      entity_id: customerId,
      meta: { erased_bookings: erasedBookings } as never,
    })

    logger.info('gdpr.tenant_erase.done', { customerId, erasedBookings })
    return { ok: true, erasedBookings }
  } catch (e) {
    logger.error('gdpr.tenant_erase.threw', {
      customerId,
      error: e instanceof Error ? e.message : String(e),
    })
    return { ok: false, reason: 'error' }
  }
}
