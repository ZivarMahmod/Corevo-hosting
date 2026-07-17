import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type NotificationPreferences = {
  notifyNewBooking: boolean
  notifyBookingChanges: boolean
  notifyDailyReminder: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notifyNewBooking: true,
  notifyBookingChanges: true,
  notifyDailyReminder: false,
}

export async function getNotificationPreferences(params: {
  tenantId: string
  staffId: string
}): Promise<NotificationPreferences> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenant_member_permissions')
    .select('notify_new_booking, notify_booking_changes, notify_daily_reminder')
    .eq('tenant_id', params.tenantId)
    .eq('staff_id', params.staffId)
    .maybeSingle()
  if (error) throw new Error('Kunde inte läsa notisinställningarna.')
  return data
    ? {
        notifyNewBooking: data.notify_new_booking,
        notifyBookingChanges: data.notify_booking_changes,
        notifyDailyReminder: data.notify_daily_reminder,
      }
    : DEFAULT_NOTIFICATION_PREFERENCES
}
