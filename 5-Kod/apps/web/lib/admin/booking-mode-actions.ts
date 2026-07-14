'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant, revalidateTenant } from './tenant'
import { getAdminModuleStates, moduleAdminState } from './modules'
import { bookingModeFromState, canSwitch, parseBookingMode, stateForMode } from './booking-mode'

/** L3 C-03 — enda skrivvägen för bokningsläget. Skriver tenant_modules.state för
 *  `booking` med den INLOGGADES klient: RLS staketar raden till egna tenanten och
 *  DB-vakten (0026) släpper live↔paused men aldrig off→på. Ingen ny flaggmekanism,
 *  ingen service-role-genväg förbi vakten. */

export type BookingModeState = { error?: string; success?: string }

const GENERIC = 'Något gick fel. Försök igen.'

export async function setBookingMode(
  _prev: BookingModeState,
  fd: FormData,
): Promise<BookingModeState> {
  const user = await requireAdminArea('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: 'Inget företag är kopplat till ditt konto.' }

  const next = parseBookingMode(fd.get('mode'))
  if (!next) return { error: GENERIC }

  const states = await getAdminModuleStates(tenant.id)
  const current = bookingModeFromState(
    'booking' in states ? moduleAdminState(states, 'booking') : undefined,
  )
  if (current === next) return { success: 'Läget är redan satt.' }
  if (!canSwitch(current, next)) {
    return {
      error:
        current === 'av'
          ? 'Bokningen är avstängd av Corevo. Kontakta oss för att sätta på den igen.'
          : GENERIC,
    }
  }

  const state = stateForMode(next)
  if (!state) return { error: GENERIC }

  const supabase = await createClient()
  // UPDATE, aldrig INSERT: en tenant utan booking-rad räknas som live (historisk
  // default) och DB-vakten skulle neka en INSERT med state<>'off' ändå. Träffar
  // uppdateringen 0 rader säger vi det ärligt i stället för att låtsas ha sparat.
  const { data, error } = await supabase
    .from('tenant_modules')
    .update({ state })
    .eq('tenant_id', tenant.id)
    .eq('module_key', 'booking')
    .select('module_key')

  if (error) return { error: GENERIC }
  if (!data || data.length === 0) {
    return {
      error:
        'Bokningsmodulen är inte uppsatt för ditt konto än — kontakta Corevo så aktiverar vi den.',
    }
  }

  revalidateTenant(tenant.slug)
  revalidatePath('/admin/installningar/bokning')
  revalidatePath('/admin')
  return {
    success:
      next === 'pa'
        ? 'Bokningen är på — kunder kan boka igen.'
        : 'Bokningen är pausad — inga nya bokningar tas emot.',
  }
}
