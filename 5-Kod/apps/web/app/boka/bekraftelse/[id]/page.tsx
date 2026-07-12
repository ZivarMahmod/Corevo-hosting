import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'
import { buildCancelToken } from '@/lib/booking/cancel-token'
import { GoogleReviewNudge } from '@/components/kund/GoogleReviewNudge'
import '../../../ticket.css'

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

// Kort biljett-referens à la designens "FC-4827": salongens initialer + 4 siffror
// deterministiskt härledda ur boknings-id:t (ingen ny data, bara presentation).
function ticketRef(tenantName: string, id: string): string {
  const initials =
    (tenantName || 'BK')
      .split(/\s+/)
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'BK'
  const hex = id.replace(/-/g, '').slice(0, 6)
  const num = (Number.parseInt(hex || '0', 16) % 9000) + 1000
  return `${initials}-${num}`
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
  const start = new Date(booking.start_ts)
  const longDate = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'full', timeZone: tz }).format(start)
  const time = new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(start)

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

  // Avboka-länk: samma HMAC-capability som mejlets manage-länk. buildCancelToken
  // failar SAFE till '' utan nyckel → länken utelämnas då (ingen död länk).
  const cancelToken = await buildCancelToken(booking.id ?? id)
  const cancelHref = cancelToken ? `/avboka/${booking.id ?? id}?t=${encodeURIComponent(cancelToken)}` : null

  // Biljett-fotens etikett: designens "Att betala på plats" gäller obetald bokning;
  // en online-betald/återbetald bokning får inte påstå att pris återstår på plats.
  const footLabel = paid ? 'Betald online' : refunded ? 'Återbetald' : 'Att betala på plats'

  return (
    <section className="tkt-scope tkt-section">
      {/* H4: bocken RITAS (stroke-dashoffset) — samma payoff som köp-rälsens
          kvitto ger, i stället för en naken textrad. */}
      <div className="tkt-mark" aria-hidden>
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="tkt-mark-path" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <div className="tkt-ok">BOKAT</div>
      <h1 className="tkt-confirm-h">Tack, din tid är bokad!</h1>
      <p className="tkt-lede">En bekräftelse är på väg till din e-post.</p>

      {/* Biljetten/stubben — BEKRÄFTAD-stämpel, dashed dividers, rader, pris-fot */}
      <div className="tkt-stub tkt-stub--ticket">
        <div className="tkt-stamp" aria-hidden>
          BEKRÄFTAD
        </div>
        <div className="tkt-stub-head">
          <span className="tkt-stub-brand">{tenantName || 'Bokning'}</span>
          <span className="tkt-stub-ref">{ticketRef(tenantName, booking.id ?? id)}</span>
        </div>
        <div className="tkt-stub-grid">
          <span className="tkt-label">Tjänst</span>
          <span className="tkt-value">{booking.service_name}</span>
          {booking.staff_title ? (
            <>
              <span className="tkt-label">Hos</span>
              <span className="tkt-value">{booking.staff_title}</span>
            </>
          ) : null}
          <span className="tkt-label">Tid</span>
          <span className="tkt-value">
            {longDate}
            <br />
            <span className="tkt-value-time">kl. {time}</span>
          </span>
        </div>
        <div className="tkt-stub-foot">
          <span className="tkt-foot-label">{footLabel}</span>
          <span className="tkt-price">{kr.format((booking.price_cents ?? 0) / 100)}</span>
        </div>
      </div>

      {/* Betalning (G09): kvitto/status. paid > refunded > avbruten > väntar > på plats. */}
      {paid ? (
        <p className="tkt-note tkt-note--paid">
          ✓ Betald online — {kr.format((booking.price_cents ?? 0) / 100)}. Kvitto skickas via Stripe.
        </p>
      ) : refunded ? (
        <p className="tkt-note">Betalningen är återbetald.</p>
      ) : checkoutCancelled ? (
        <p className="tkt-note">Betalningen avbröts. Du kan betala på plats vid besöket.</p>
      ) : canTakeOnline ? (
        <p className="tkt-note">Betalningen behandlas — du får en bekräftelse strax.</p>
      ) : (
        <p className="tkt-note">Du betalar på plats vid besöket.</p>
      )}

      {/* Recension-nudge (Google review) POPUP (M4 §2.3): ignorerbar, frikopplad
          från betalning, visas oavsett betalstatus. Renderar inget om salongen
          saknar google_review_url. Skild från e-post-nudgen (status=completed). */}
      <GoogleReviewNudge
        tenantSlug={booking.tenant_slug}
        tenantName={tenantName}
        bookingId={booking.id ?? id}
      />

      <div className="tkt-actions">
        <a
          href={icsHref}
          download="bokning.ics"
          className="tkt-btn-ink"
          aria-label="Lägg till bokningen i din kalender"
        >
          Lägg till i kalender
        </a>
        <Link href="/boka" className="tkt-btn-outline">
          Boka en till tid
        </Link>
        {cancelHref ? (
          <Link href={cancelHref} className="tkt-textlink">
            Behöver du ändra? Avboka eller boka om
          </Link>
        ) : null}
      </div>

      <div className="tkt-home">
        <Link href="/" className="tkt-homelink">
          Till startsidan
        </Link>
      </div>
    </section>
  )
}
