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

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ betald?: string; avbruten?: string }>
}) {
  const { id } = await params
  const { avbruten } = await searchParams

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

  // Effektiv gate (samma som boka-flödet): online bara om BÅDA flaggorna är på.
  const canTakeOnline = booking.payments_enabled && booking.stripe_charges_enabled
  const paid = booking.payment_status === 'succeeded'
  const refunded = booking.payment_status === 'refunded'
  const checkoutCancelled = avbruten === '1'

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

        {/* Betalning (G09): kvitto/status. paid > refunded > avbruten > väntar > på plats. */}
        {paid ? (
          <p className="confirm-note confirm-paid">
            ✓ Betald online — {kr.format((booking.price_cents ?? 0) / 100)}. Kvitto skickas via Stripe.
          </p>
        ) : refunded ? (
          <p className="confirm-note">Betalningen är återbetald.</p>
        ) : checkoutCancelled ? (
          <p className="confirm-note">Betalningen avbröts. Du kan betala i salongen vid besöket.</p>
        ) : canTakeOnline ? (
          <p className="confirm-note">Betalningen behandlas — du får en bekräftelse strax.</p>
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
