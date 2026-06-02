import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getMyBookings } from '@/lib/kund/bookings'
import { getLoyaltyView } from '@/lib/kund/loyalty'
import { getCustomerId } from '@/lib/kund/customer'
import { getMyFavorites } from '@/lib/kund/favorites'
import { BookingList } from '@/components/kund/BookingList'
import { LoyaltyCard } from '@/components/kund/LoyaltyCard'
import { FavoritesList } from '@/components/kund/FavoritesList'
import styles from '@/components/kund/kund.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mina tider' }

export default async function KontoPage() {
  const user = await requirePortal('kund')
  const tenantId = user.tenantId ?? ''

  // Resolve the durable customer id once (favorites + the favorite-state in the
  // loyalty band both need it); read-only, may be null for a never-booked account.
  const customerId = await getCustomerId(user.id, tenantId)

  const [{ upcoming, past }, loyalty, favorites] = await Promise.all([
    getMyBookings(user.id),
    getLoyaltyView(user.id, tenantId, customerId),
    getMyFavorites(customerId),
  ])

  const favoriteStaffIds = favorites
    .filter((f) => f.kind === 'staff' && f.staffId)
    .map((f) => f.staffId as string)

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

      <h2 className={styles.groupTitle}>Lojalitet</h2>
      <LoyaltyCard view={loyalty} favoriteStaffIds={favoriteStaffIds} />

      <h2 className={styles.groupTitle}>Favoriter</h2>
      <FavoritesList favorites={favorites} />

      <h2 className={styles.groupTitle}>Tidigare</h2>
      <BookingList bookings={past} empty="Ingen bokningshistorik ännu." />
    </section>
  )
}
