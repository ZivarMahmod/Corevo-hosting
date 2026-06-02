import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { currentTenant } from '@/lib/tenant-data'
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

  // Salon name for the greeting heading. Same cached/deduped read the /konto layout
  // already makes (it 404s when there is no tenant, so this is resolvable here);
  // read-only, additive. NO person name exists on a kund account — only email — so
  // the greeting is generic (salon name + "Välkommen tillbaka"), never "Hej <namn>".
  const bundle = await currentTenant()
  const salonName = bundle?.tenant.name?.trim() || null

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
        <div>
          <span
            style={{
              display: 'block',
              fontSize: '0.78rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              opacity: 0.6,
              marginBottom: '0.35rem',
            }}
          >
            Välkommen tillbaka
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {salonName ?? 'Välkommen tillbaka'}
          </h1>
        </div>
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
