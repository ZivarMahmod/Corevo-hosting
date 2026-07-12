'use server'

import { revalidatePath } from 'next/cache'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { createClient } from '@/lib/supabase/server'

export type DropInState = { success?: string; error?: string }

/**
 * Drop-in-bokning från Bokningsvyn (Zivar 2026-07-10: kund kliver in i salongen
 * → frisören trycker på en ledig tid → bokad med 2 tryck, och tiden försvinner
 * ur det publika flödet i samma stund).
 *
 * Går genom SAMMA väg som kundbokningar — create_public_booking-RPC:n — så alla
 * skydd gäller: staff↔plats-fencet, no_double_booking-constrainten (kunden som
 * bokar online på vägen och drop-in:en kan aldrig få samma tid; förloraren får
 * ett ärligt fel), och tiden räknas bort ur getAvailableSlots direkt eftersom
 * det är samma bookings-tabell. RPC:n lämnar 'pending' → vi bekräftar direkt
 * (ägarens egen cookie-klient, RLS-fencad) — en drop-in ÄR bekräftad, kunden
 * står ju i lokalen. Pending-expiry-svepet rör den ändå aldrig (kräver
 * payments-rad). Inget mail skickas — ingen adress finns.
 */
export async function createDropInBooking(_p: DropInState, fd: FormData): Promise<DropInState> {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: 'Inget företag är kopplat till ditt konto.' }

  const staffId = String(fd.get('staff') ?? '')
  const serviceId = String(fd.get('service') ?? '')
  const start = String(fd.get('start') ?? '')
  const locationId = String(fd.get('location') ?? '')
  if (!staffId || !serviceId || Number.isNaN(Date.parse(start))) {
    return { error: 'Ogiltig tid eller tjänst — ladda om och försök igen.' }
  }

  const supabase = await createClient()
  const { data: bookingId, error } = await supabase.rpc('create_public_booking', {
    p_tenant_slug: tenant.slug,
    p_service: serviceId,
    p_staff: staffId,
    p_location: locationId || undefined,
    p_start: start,
    p_guest_name: 'Drop-in',
    p_note: 'Drop-in — bokad i Bokningsvyn',
    p_request_id: crypto.randomUUID(),
  })
  if (error || !bookingId) {
    const msg = error?.message ?? ''
    if (msg.includes('no_double_booking') || error?.code === '23P01') {
      return { error: 'Tiden hann bli tagen av en annan bokning — listan är uppdaterad.' }
    }
    if (msg.includes('start_in_past')) return { error: 'Tiden har redan passerat.' }
    if (msg.includes('invalid_staff_location')) {
      return { error: 'Medarbetaren har inga tider på den platsen.' }
    }
    return { error: 'Bokningen gick inte igenom. Försök igen.' }
  }

  // Drop-in = bekräftad direkt (kunden står i lokalen). Misslyckas uppdateringen
  // står bokningen kvar som obekräftad — tiden är ändå blockad, inget går sönder.
  await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)
    .eq('tenant_id', tenant.id)

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin/bokningar/vy')
  return { success: 'Drop-in bokad — tiden är blockad för onlinebokning.' }
}
