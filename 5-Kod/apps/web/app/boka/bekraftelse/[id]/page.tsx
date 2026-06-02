import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'
import { GoogleReviewNudge } from '@/components/kund/GoogleReviewNudge'
import styles from '@/components/booking/booking.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokning bekräftad' }

const kr = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})

// ── "Lägg till i kalender": en RFC5545-iCal-fil (.ics) byggd server-side från
// fält vi redan har (start_ts/end_ts/service/personal/salong). Inget extra
// data-anrop. Levereras som data:-URL så <a download> sparar filen direkt. ──
function icsStamp(iso: string): string {
  // → YYYYMMDDTHHMMSSZ (UTC). Date.toISOString ger UTC; strippa skiljetecken/ms.
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}
function buildIcs(opts: {
  id: string
  startISO: string
  endISO: string
  summary: string
  description: string
  location: string
}): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Corevo//Booking//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${opts.id}@corevo.booking`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(opts.startISO)}`,
    `DTEND:${icsStamp(opts.endISO)}`,
    `SUMMARY:${icsEscape(opts.summary)}`,
    `DESCRIPTION:${icsEscape(opts.description)}`,
    `LOCATION:${icsEscape(opts.location)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

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

  // .ics-fil (lägg till i kalender). end_ts finns i RPC:n → exakt sluttid.
  const tenantName = booking.tenant_name ?? ''
  const summary = tenantName
    ? `${booking.service_name} – ${tenantName}`
    : (booking.service_name ?? 'Bokning')
  const descParts = [
    booking.staff_title ? `Hos ${booking.staff_title}` : null,
    booking.price_cents ? `Pris: ${kr.format((booking.price_cents ?? 0) / 100)}` : null,
  ].filter(Boolean) as string[]
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(
    buildIcs({
      id: booking.id ?? id,
      startISO: booking.start_ts,
      endISO: booking.end_ts ?? booking.start_ts,
      summary,
      description: descParts.join(' · '),
      location: booking.location_name ?? tenantName,
    }),
  )}`

  return (
    <section className="section">
      <div className="section-inner booking-confirm">
        <div
          className="confirm-badge"
          aria-hidden
          style={{
            background: 'var(--color-accent, var(--color-primary))',
            color: 'var(--color-fg, #15281f)',
          }}
        >
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

        {/* Recension-nudge (Google review) POPUP (M4 §2.3): ignorerbar, frikopplad
            från betalning, visas oavsett betalstatus. Renderar inget om salongen
            saknar google_review_url. Skild från e-post-nudgen (status=completed). */}
        <GoogleReviewNudge
          tenantSlug={booking.tenant_slug}
          tenantName={tenantName}
          bookingId={booking.id ?? id}
        />

        <div className={styles.confirmActions}>
          <a
            href={icsHref}
            download="bokning.ics"
            className={styles.calendarBtn}
            aria-label="Lägg till bokningen i din kalender"
          >
            📅 Lägg till i kalender
          </a>
          <Link href="/" className="btn-primary">
            Till startsidan
          </Link>
        </div>
      </div>
    </section>
  )
}
