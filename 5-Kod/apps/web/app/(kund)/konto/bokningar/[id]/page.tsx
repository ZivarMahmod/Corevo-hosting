import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePortal } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getMyBooking } from '@/lib/kund/bookings'
import { getCancellationCutoffHours, withinCancellationWindow } from '@/lib/kund/settings'
import { formatSlot, formatPrice, statusLabel } from '@/lib/kund/format'
import { CancelButton } from '@/components/kund/CancelButton'
import { RebookPanel } from '@/components/kund/RebookPanel'
import styles from '@/components/kund/kund.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokning' }

const ACTIVE = new Set(['pending', 'confirmed'])

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePortal('kund')
  const booking = await getMyBooking(user.id, id)
  if (!booking) notFound()

  const supabase = await createClient()
  const cutoff = await getCancellationCutoffHours(supabase, user.tenantId ?? '')
  const isActive = ACTIVE.has(booking.status)
  const inWindow = withinCancellationWindow(booking.startTs, cutoff)
  const canChange = isActive && inWindow

  return (
    <section className="portal-section">
      <Link href="/konto" className={styles.back}>
        ← Mina tider
      </Link>
      <h1>{booking.serviceName ?? 'Bokning'}</h1>

      <div className={styles.detail}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Tid</span>
          <span>{formatSlot(booking.startTs, booking.timeZone)}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Personal</span>
          <span>{booking.staffTitle ?? '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Status</span>
          <span>{statusLabel(booking.status)}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Pris</span>
          <span>{booking.priceCents != null ? formatPrice(booking.priceCents) : '—'}</span>
        </div>
      </div>

      {canChange ? (
        <div className={styles.actions}>
          <RebookPanel bookingId={booking.id} serviceId={booking.serviceId} />
          <CancelButton bookingId={booking.id} />
        </div>
      ) : isActive ? (
        <p className={styles.notice}>
          Den här tiden kan inte längre ändras online (avbokning måste ske minst {cutoff} timmar i
          förväg). Kontakta salongen för att ändra eller avboka.
        </p>
      ) : (
        <p className={styles.notice}>Den här bokningen är avslutad.</p>
      )}
    </section>
  )
}
