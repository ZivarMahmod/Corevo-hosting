import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getMyBookings } from '@/lib/kund/bookings'
import { BookingList } from '@/components/kund/BookingList'
import styles from '@/components/kund/kund.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mina tider' }

export default async function KontoPage() {
  const user = await requirePortal('kund')
  const { upcoming, past } = await getMyBookings(user.id)

  return (
    <section className="portal-section">
      <div className={styles.headRow}>
        <h1>Mina tider</h1>
        <Link href="/konto/profil" className={styles.headLink}>
          Min profil →
        </Link>
      </div>

      <h2 className={styles.groupTitle}>Kommande</h2>
      <BookingList
        bookings={upcoming}
        empty="Inga bokningar än. Boka din första tid så dyker den upp här."
        emptyCta
      />

      <h2 className={styles.groupTitle}>Tidigare</h2>
      <BookingList bookings={past} empty="Ingen bokningshistorik ännu." />
    </section>
  )
}
