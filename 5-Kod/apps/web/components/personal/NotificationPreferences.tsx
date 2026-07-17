'use client'

import { useActionState } from 'react'
import {
  saveNotificationPreferences,
  type NotificationPreferenceState,
} from '@/lib/personal/notification-preference-actions'
import type { NotificationPreferences as Values } from '@/lib/personal/notification-preferences'
import styles from './personal-pwa.module.css'

const notificationRows = [
  ['notify_new_booking', 'Ny bokning', 'När en bokning läggs i din kalender'],
  ['notify_booking_changes', 'Ändrad eller avbokad', 'När din arbetsdag ändras'],
  ['notify_daily_reminder', 'Dagens schema', 'En sammanfattning före arbetsdagen'],
] as const

export function NotificationPreferences({ values }: { values: Values }) {
  const [state, action, pending] = useActionState<NotificationPreferenceState, FormData>(
    saveNotificationPreferences,
    {},
  )
  const checked = {
    notify_new_booking: values.notifyNewBooking,
    notify_booking_changes: values.notifyBookingChanges,
    notify_daily_reminder: values.notifyDailyReminder,
  }
  return (
    <form action={action}>
      {notificationRows.map(([name, label, hint]) => (
        <label className={styles.notificationRow} key={name}>
          <span><strong>{label}</strong><small>{hint}</small></span>
          <input type="checkbox" name={name} value="true" defaultChecked={checked[name]} />
        </label>
      ))}
      {/* ÄRLIGT KONTRAKT: valen sparas men utskickskanalen för personalnotiser är
          inte inkopplad än (plan 014 — notiser via router/outbox). Säg det, i
          stället för att låta ett sparat val se ut att styra något som inte skickas. */}
      <p className={styles.notificationNote} role="note">
        Dina val sparas nu och börjar gälla när personalnotiserna aktiveras — utskicken är
        inte påslagna än.
      </p>
      <div className={styles.notificationSave}>
        <span role="status">{state.error ?? state.success ?? ''}</span>
        <button type="submit" disabled={pending}>{pending ? 'Sparar…' : 'Spara'}</button>
      </div>
    </form>
  )
}
