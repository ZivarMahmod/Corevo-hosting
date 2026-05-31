import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokning bekräftad' }

const kr = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = createPublicClient()
  const { data } = await supabase.rpc('get_public_booking', { p_id: id })
  const booking = data?.[0]
  if (!booking) notFound()

  const tz = booking.location_timezone ?? 'Europe/Stockholm'
  const when = new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: tz,
  }).format(new Date(booking.start_ts))
  const requiresPayment = booking.payment_mode === 'online' || booking.payment_mode === 'both'

  return (
    <section className="section">
      <div className="section-inner booking-confirm">
        <div className="confirm-badge" aria-hidden>
          ✓
        </div>
        <h1>Tack, din tid är bokad!</h1>
        <ul className="confirm-summary">
          <li>
            <span>Tjänst</span>
            <strong>{booking.service_name}</strong>
          </li>
          <li>
            <span>Tid</span>
            <strong>{when}</strong>
          </li>
          {booking.staff_title ? (
            <li>
              <span>Hos</span>
              <strong>{booking.staff_title}</strong>
            </li>
          ) : null}
          <li>
            <span>Pris</span>
            <strong>{kr.format((booking.price_cents ?? 0) / 100)}</strong>
          </li>
        </ul>

        {/* Betalning (G09-krok): on_site = betala på plats; online/both kopplas på här. */}
        {requiresPayment ? (
          <p className="confirm-note">
            Onlinebetalning läggs till snart. Tills vidare betalar du i salongen.
          </p>
        ) : (
          <p className="confirm-note">Du betalar på plats vid besöket.</p>
        )}

        {/* Recension-nudge (Google review): fyrar när booking.status = 'completed'.
            Byggs senare — lämnar bara kroken här. */}

        <Link href="/" className="btn-primary">
          Till startsidan
        </Link>
      </div>
    </section>
  )
}
