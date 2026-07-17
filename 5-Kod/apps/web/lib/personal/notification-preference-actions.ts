'use server'

import { revalidatePath } from 'next/cache'
import { requirePortal } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export type NotificationPreferenceState = { success?: string; error?: string }

export async function saveNotificationPreferences(
  _previous: NotificationPreferenceState,
  formData: FormData,
): Promise<NotificationPreferenceState> {
  await requirePortal('personal')
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_my_notification_preferences', {
    p_notify_new_booking: formData.get('notify_new_booking') === 'true',
    p_notify_booking_changes: formData.get('notify_booking_changes') === 'true',
    p_notify_daily_reminder: formData.get('notify_daily_reminder') === 'true',
  })
  if (error) return { error: 'Notisinställningarna kunde inte sparas.' }
  revalidatePath('/personal/profil')
  return { success: 'Notisinställningarna är sparade.' }
}
