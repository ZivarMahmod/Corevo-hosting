import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getMyBookings } from '@/lib/kund/bookings'
import { BookingList } from '@/components/kund/BookingList'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mina tider' }

export default async function KontoPage() {
  const user = await requirePortal('kund')
  const { upcoming, past } = await getMyBookings(user.id)

  return (
    <section className="portal-section">
      <div className="portal-section-head">
        <h1>Mina tider</h1>
        <Link href="/konto/profil" className="prose">
          Min profil
        </Link>
      </div>

      <h2>Kommande</h2>
      <BookingList bookings={upcoming} empty="Du har inga kommande bokningar." />

      <h2>Tidigare</h2>
      <BookingList bookings={past} empty="Ingen bokningshistorik ännu." />
    </section>
  )
}
