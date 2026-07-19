import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff } from '@/lib/personal/staff'
import { getMyWorkingHours, getMyTimeOff } from '@/lib/personal/schedule'
import { fmtDateTime, WEEKDAYS_SV } from '@/lib/personal/format'
import { getNotificationPreferences } from '@/lib/personal/notification-preferences'
import { NotificationPreferences } from '@/components/personal/NotificationPreferences'
import styles from '@/components/personal/personal-pwa.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Min profil · Corevo Personal' }

export default async function PersonalProfilePage() {
  const user = await requirePortal('personal')
  const staff = await getMyStaff(user.id)
  const primary = staff[0]
  const staffIds = staff.map((member) => member.id)
  const [hours, absences, notifications] = await Promise.all([
    getMyWorkingHours(staffIds),
    getMyTimeOff(staffIds),
    user.tenantId && primary
      ? getNotificationPreferences({ tenantId: user.tenantId, staffId: primary.id })
      : Promise.resolve({ notifyNewBooking: true, notifyBookingChanges: true, notifyDailyReminder: false }),
  ])
  const byWeekday = new Map<number, string[]>()
  for (const row of hours) {
    const current = byWeekday.get(row.weekday) ?? []
    current.push(`${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}`)
    byWeekday.set(row.weekday, current)
  }
  const now = Date.now()
  const upcoming = absences.find((row) => new Date(row.endTs).getTime() >= now)
  const displayName = user.name || primary?.title || user.email?.split('@')[0] || 'Inloggad'
  const roleLabel = user.roleLevel >= 6 ? 'ÄGARE' : 'FRISÖR'

  return (
    <section className={styles.profileScreen} data-accept="personal-profile">
      <h1>Min profil</h1>

      <div className={`${styles.profileCard} ${styles.identity}`}>
        <span className={styles.identityAvatar}>{displayName.slice(0, 1).toUpperCase()}</span>
        <span className={styles.identityCopy}>
          <strong>{displayName} <i className={styles.roleChip}>{roleLabel}</i></strong>
          <small>{user.email ?? 'Personligt konto'}</small>
        </span>
        <span className={styles.onlineDot} title="Aktivt konto" />
      </div>

      <div className={styles.profileCard}>
        <p className={styles.sectionLabel}><span>NOTISER</span></p>
        <NotificationPreferences values={notifications} />
      </div>

      <div className={styles.profileCard}>
        <p className={styles.sectionLabel}><span>MINA PASS</span><span>VECKA</span></p>
        {Array.from({ length: 7 }, (_, index) => (index + 1) % 7).map((weekday) => (
          <div className={styles.profileRow} key={weekday}>
            <span>{WEEKDAYS_SV[weekday]}</span>
            <code>{byWeekday.get(weekday)?.join(', ') ?? 'Ledig'}</code>
          </div>
        ))}
      </div>

      <div className={styles.profileCard}>
        <p className={styles.sectionLabel}><span>FRÅNVARO & LEDIGHET</span></p>
        <div className={styles.profileRow}>
          <span><strong>{upcoming?.reason ?? 'Ingen kommande frånvaro'}</strong></span>
          <code>{upcoming && primary ? fmtDateTime(upcoming.startTs, primary.timeZone) : '—'}</code>
        </div>
        <div className={styles.profileActions}>
          <Link href="/personal/franvaro">Hantera frånvaro</Link>
          <Link href="/personal/arbetstider">Se hela schemat</Link>
        </div>
      </div>

      <div className={styles.profileCard}>
        <p className={styles.sectionLabel}><span>KONTO</span></p>
        <Link className={styles.profileRow} href="/personal/konto"><span>Byt lösenord</span><span>›</span></Link>
      </div>
    </section>
  )
}
