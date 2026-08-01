import Link from 'next/link'
import type { PortalBookingProjection, PortalSessionSnapshot } from '@/lib/customer-portal/types'
import {
  formatPortalBooking,
  portalRebookAction,
  portalStatusPresentation,
} from '@/lib/customer-portal/presentation'
import { PortalBookingCancellation } from './CancelBookingDialog'
import {
  CalendarBookingProvider,
  CalendarDownloadButton,
} from './CalendarDownloadButton'
import { BookAgainButton, BookAgainProvider } from './BookAgainButton'

function StatusIcon({ icon }: { icon: ReturnType<typeof portalStatusPresentation>['icon'] }) {
  return (
    <svg className="cp-icon cp-status-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {icon === 'check' && <path d="m3 8 3 3 7-7" />}
      {icon === 'clock' && <><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></>}
      {icon === 'cross' && <path d="m4 4 8 8M12 4 4 12" />}
      {icon === 'unknown' && <><circle cx="8" cy="8" r="6" /><path d="M6.5 6.5a1.5 1.5 0 1 1 2.5 1.1c-.7.6-1 1-1 1.8M8 11.8h.01" /></>}
    </svg>
  )
}

export function BookingStatusChip({ booking }: { booking: PortalBookingProjection }) {
  const status = portalStatusPresentation(booking)
  return (
    <span className={`cp-status cp-status-${status.tone}`}>
      <StatusIcon icon={status.icon} />
      {status.label}
    </span>
  )
}

const locationText = (booking: PortalBookingProjection) =>
  [booking.location?.name, booking.location?.address].filter(Boolean).join(', ') || null

function Chevron() {
  return <svg className="cp-icon cp-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
}

export function TenantIdentityCard({ snapshot }: { snapshot: PortalSessionSnapshot }) {
  const origin = new URL(snapshot.bookingOrigin).host
  return (
    <section className="cp-card cp-identity" aria-labelledby="tenant-namn">
      {snapshot.logoUrl ? (
        // The tenant name immediately beside the decorative logo carries its accessible identity.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cp-tenant-avatar" src={snapshot.logoUrl} alt="" />
      ) : (
        <span className="cp-tenant-avatar" aria-hidden="true">{snapshot.tenantName.trim().charAt(0)}</span>
      )}
      <div className="cp-identity-copy">
        <h1 id="tenant-namn">{snapshot.tenantName}</h1>
        {snapshot.verticalLabel && <p>{snapshot.verticalLabel}</p>}
        {snapshot.address && <p>{snapshot.address}</p>}
        <p className="cp-meta">Du bokade via {origin}</p>
        {(snapshot.phone || (snapshot.address && snapshot.mapUrl)) && (
          <div className="cp-actions">
            {snapshot.phone && <a className="cp-btn" href={`tel:${snapshot.phone}`}>Ring</a>}
            {snapshot.address && snapshot.mapUrl && (
              <a className="cp-btn" href={snapshot.mapUrl} rel="noopener">Hitta hit</a>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function BookingFacts({
  booking,
  snapshot,
}: {
  booking: PortalBookingProjection
  snapshot: PortalSessionSnapshot
}) {
  const formatted = formatPortalBooking(booking, snapshot)
  const location = locationText(booking)
  return (
    <div className="cp-fact-list">
      <span>{booking.serviceName} · {booking.durationMinutes} min</span>
      <span>{booking.staffTitle || 'Valfri personal'}</span>
      {location && <span>{location}</span>}
      {formatted.price && <span>{formatted.price}</span>}
    </div>
  )
}

function isFutureActiveBooking(booking: PortalBookingProjection) {
  return (booking.presentationStatus === 'pending' || booking.presentationStatus === 'confirmed') &&
    Date.parse(booking.startTs) > Date.now()
}

function cancellationSummary(
  booking: PortalBookingProjection,
  snapshot: PortalSessionSnapshot,
) {
  const formatted = formatPortalBooking(booking, snapshot)
  return `${formatted.homeDateTime} — ${booking.serviceName} hos ${snapshot.tenantName}`
}

function cancellationContact(booking: PortalBookingProjection, snapshot: PortalSessionSnapshot) {
  return {
    phone: booking.location?.phone || snapshot.phone,
    website: snapshot.bookingOrigin,
  }
}

function PolicyBlockedCancellation({
  booking,
  snapshot,
}: {
  booking: PortalBookingProjection
  snapshot: PortalSessionSnapshot
}) {
  const contact = cancellationContact(booking, snapshot)
  return (
    <p className="cp-cancel-blocked" role="status">
      {contact.phone ? (
        <>Den här bokningen kan inte längre avbokas online. Ring {snapshot.tenantName} på{' '}
          <a href={`tel:${contact.phone}`}>{contact.phone}</a>.</>
      ) : (
        <>Den här bokningen kan inte längre avbokas online. Kontakta {snapshot.tenantName} via{' '}
          <a href={contact.website} rel="noopener">deras webbplats</a>.</>
      )}
    </p>
  )
}

function ActiveBookAgainButton({
  snapshot,
  booking,
}: {
  snapshot: PortalSessionSnapshot
  booking: PortalBookingProjection
}) {
  const button = <BookAgainButton label="Boka en tid till" />
  // An active booking always keeps the tenant base fallback. When SQL supplied
  // a validated context URL, bind that exact service/location instead.
  return booking.publicRebookUrl ? (
    <BookAgainProvider snapshot={snapshot} booking={booking}>{button}</BookAgainProvider>
  ) : (
    <BookAgainProvider snapshot={snapshot}>{button}</BookAgainProvider>
  )
}

export function NextBookingCard({
  snapshot,
  items,
  hasHistory,
}: {
  snapshot: PortalSessionSnapshot
  items: PortalBookingProjection[]
  hasHistory: boolean
}) {
  const next = items[0]
  if (!next) {
    return (
      <section className="cp-card cp-empty" aria-labelledby="ingen-kommande">
        <svg className="cp-icon cp-empty-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 2v4M16 2v4M8 10h8M8 14h5" /></svg>
        <h2 id="ingen-kommande">Ingen kommande bokning</h2>
        <p>{hasHistory
          ? 'Du har ingen bokning på gång just nu.'
          : `Du har inga bokningar hos ${snapshot.tenantName} ännu.`}</p>
        <BookAgainProvider snapshot={snapshot}>
          <BookAgainButton label="Boka ny tid" variant="primary" />
        </BookAgainProvider>
      </section>
    )
  }

  const formatted = formatPortalBooking(next, snapshot)
  const canCancel = next.canCancel && isFutureActiveBooking(next)
  return (
    <>
      <article className="cp-card cp-next-booking" aria-labelledby="nasta-bokning">
        <div className="cp-ticket-head">
          <h2 id="nasta-bokning" className="cp-eyebrow" data-cancel-focus-target tabIndex={-1}>
            NÄSTA BOKNING
          </h2>
          <BookingStatusChip booking={next} />
        </div>
        <div className="cp-date-lockup" aria-label={formatted.homeDateTime}>
          <span className="cp-date-day">{formatted.homeDay}</span>
          <span className="cp-date-divider" aria-hidden="true" />
          <span className="cp-date-copy">
            <strong>{formatted.homeWeekday}</strong>
            <span>{formatted.homeMonth} · {formatted.homeTime}</span>
          </span>
        </div>
        <BookingFacts booking={next} snapshot={snapshot} />
        <div className="cp-actions">
          <Link className="cp-btn cp-btn-primary" href={`/mina/bokningar/${next.id}`}>Visa bokningen</Link>
          {isFutureActiveBooking(next) && (
            <CalendarBookingProvider bookingPublicId={next.id}>
              <CalendarDownloadButton />
            </CalendarBookingProvider>
          )}
          {canCancel && (
            <PortalBookingCancellation
              bookingPublicId={next.id}
              expectedCutoffHours={snapshot.cancellationCutoffHours}
              tenantName={snapshot.tenantName}
              bookingSummary={cancellationSummary(next, snapshot)}
              policyText={deadlineText(next, snapshot)}
              triggerLabel="Avboka"
              blockedContact={cancellationContact(next, snapshot)}
              variant="home"
            />
          )}
        </div>
      </article>
      {items.length > 1 && (
        <section className="cp-booking-list" aria-labelledby="fler-kommande">
          <h2 id="fler-kommande">Fler kommande</h2>
          <ul>
            {items.slice(1).map((item) => {
              const date = formatPortalBooking(item, snapshot)
              return (
                <li key={item.id}>
                  <Link className="cp-booking-link" href={`/mina/bokningar/${item.id}`}>
                      <span className="cp-booking-copy">
                        <span className="cp-mono">{date.homeDateTime}</span>
                        <span>{item.serviceName}</span>
                        {item.staffTitle && <small>{item.staffTitle}</small>}
                      </span>
                    <BookingStatusChip booking={item} />
                    <Chevron />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {isFutureActiveBooking(next) && (
        <div className="cp-actions">
          <ActiveBookAgainButton snapshot={snapshot} booking={next} />
        </div>
      )}
    </>
  )
}

function deadlineText(booking: PortalBookingProjection, snapshot: PortalSessionSnapshot) {
  if (!booking.cancelDeadline) return null
  const value = new Intl.DateTimeFormat(snapshot.locale, {
    timeZone: snapshot.timezone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(booking.cancelDeadline))
  return `Kostnadsfri avbokning till ${value}.`
}

export function BookingDetail({
  snapshot,
  booking,
  backTarget = '/mina',
}: {
  snapshot: PortalSessionSnapshot
  booking: PortalBookingProjection
  backTarget?: '/mina' | '/mina/historik'
}) {
  const formatted = formatPortalBooking(booking, snapshot)
  const deadline = deadlineText(booking, snapshot)
  const rebookAction = portalRebookAction(booking)
  const futureActive = isFutureActiveBooking(booking)
  const canCancel = booking.canCancel && futureActive
  const policyBlocked = !booking.canCancel && futureActive
  return (
    <article className="cp-detail">
      <Link className="cp-btn cp-btn-ghost cp-back" href={backTarget}>
        <svg className="cp-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m12 4-6 6 6 6" /></svg>
        Tillbaka
      </Link>
      <BookingStatusChip booking={booking} />
      <h1 className="cp-mono" data-cancel-focus-target tabIndex={-1}>{formatted.detailDateTime}</h1>
      <div className="cp-detail-grid">
        <section className="cp-card"><span className="cp-label">Tjänst</span><h2>{booking.serviceName} · {booking.durationMinutes} min</h2></section>
        {booking.staffTitle && <section className="cp-card"><span className="cp-label">Personal</span><p>{booking.staffTitle}</p></section>}
        {booking.location && (booking.location.name || booking.location.address || booking.location.phone || booking.location.mapUrl) && (
          <section className="cp-card">
            <span className="cp-label">Plats</span>
            {booking.location.name && <h2>{booking.location.name}</h2>}
            {booking.location.address && <p>{booking.location.address}</p>}
            {(booking.location.phone || booking.location.mapUrl) && <div className="cp-actions">
              {booking.location.phone && <a className="cp-btn" href={`tel:${booking.location.phone}`}>Ring</a>}
              {booking.location.mapUrl && <a className="cp-btn" href={booking.location.mapUrl} rel="noopener">Öppna i karta</a>}
            </div>}
          </section>
        )}
        {formatted.price && <section className="cp-card"><span className="cp-label">Pris</span><p className="cp-mono">{formatted.price}</p></section>}
        {deadline && <section className="cp-card"><span className="cp-label">Avbokningsvillkor</span><p>{deadline}</p></section>}
      </div>
      {(futureActive || (booking.publicRebookUrl && rebookAction) || canCancel) && (
        <div className="cp-actions">
          {futureActive && (
            <CalendarBookingProvider bookingPublicId={booking.id}>
              <CalendarDownloadButton />
            </CalendarBookingProvider>
          )}
          {canCancel && (
            <PortalBookingCancellation
              bookingPublicId={booking.id}
              expectedCutoffHours={snapshot.cancellationCutoffHours}
              tenantName={snapshot.tenantName}
              bookingSummary={cancellationSummary(booking, snapshot)}
              policyText={deadline}
              triggerLabel="Avboka bokningen"
              blockedContact={cancellationContact(booking, snapshot)}
              variant="detail"
            />
          )}
          {rebookAction === 'active' && (
            <ActiveBookAgainButton snapshot={snapshot} booking={booking} />
          )}
          {rebookAction === 'historic' && booking.publicRebookUrl && (
            <BookAgainProvider snapshot={snapshot} booking={booking}>
              <BookAgainButton label="Boka igen" />
            </BookAgainProvider>
          )}
        </div>
      )}
      {policyBlocked && <PolicyBlockedCancellation booking={booking} snapshot={snapshot} />}
    </article>
  )
}

export function PortalErrorState({
  variant,
  headingLevel = 'h1',
}: {
  variant: 'server' | 'fetch-bookings' | 'fetch-history' | 'fetch-detail' | 'not-found'
  headingLevel?: 'h1' | 'h3'
}) {
  const Heading = headingLevel
  if (variant === 'not-found') {
    return <section className="cp-card cp-error"><Heading>Bokningen kunde inte visas</Heading><Link className="cp-btn cp-btn-ghost" href="/mina">Tillbaka</Link></section>
  }
  const text = variant === 'fetch-bookings'
    ? 'Bokningarna kunde inte hämtas. Din bokning är oförändrad.'
    : variant === 'fetch-history'
      ? 'Historiken kunde inte hämtas.'
      : variant === 'fetch-detail'
        ? 'Bokningen kunde inte hämtas. Din bokning är oförändrad.'
        : null
  return (
    <section className="cp-card cp-error">
      <svg className="cp-icon cp-error-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
      <Heading>{text || 'Något gick fel hos oss.'}</Heading>
      {!text && <p>Försök igen om en stund.</p>}
      <a className="cp-btn" href="">Försök igen</a>
    </section>
  )
}
