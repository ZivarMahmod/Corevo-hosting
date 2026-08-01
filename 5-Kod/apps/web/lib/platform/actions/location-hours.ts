'use server'

import { revalidatePath } from 'next/cache'
import { parseLocationBookingSettings, type LocationSettingsRpc } from '@/lib/admin/location-settings-form'
import { revalidateTenantById } from '@/lib/admin/tenant'
import { assertPlatformTenantAccess, platformCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { GENERIC, type ActionState } from './shared'
import { reportActionError } from './observe'

export async function savePlatformLocationBookingSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenant_id') ?? '').trim()
  if (!tenantId) return { error: 'Saknar kund.' }

  const parsed = parseLocationBookingSettings(fd)
  if ('error' in parsed) return parsed

  try {
    await assertPlatformTenantAccess(supabase, tenantId)
  } catch {
    return { error: 'Platsen finns inte hos den här kunden.' }
  }

  const { data: location, error: locationError } = await supabase
    .from('locations')
    .select('id')
    .eq('id', parsed.locationId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .maybeSingle()
  if (locationError) {
    await reportActionError('savePlatformLocationBookingSettings.location', locationError, { tenantId })
    return { error: GENERIC }
  }
  if (!location) return { error: 'Platsen finns inte hos den här kunden.' }

  const { error } = await (supabase as unknown as LocationSettingsRpc).rpc('save_location_booking_settings', {
    p_location: parsed.locationId,
    p_hours: parsed.hours,
    p_slot_step_min: parsed.slotStepMin,
    p_min_notice_min: parsed.minNoticeMin,
    p_max_advance_days: parsed.maxAdvanceDays,
  })
  if (error) {
    await reportActionError('savePlatformLocationBookingSettings.rpc', error, {
      tenantId,
      locationId: parsed.locationId,
    })
    return { error: GENERIC }
  }

  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/kunder/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.location_hours_save',
    tenantId,
    actorId: user.id,
    entityId: parsed.locationId,
  })
  return { success: 'Öppettider och bokningsregler sparade.' }
}
