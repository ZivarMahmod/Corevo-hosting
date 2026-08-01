'use client'

import { useState, useTransition } from 'react'
import {
  revokeOtherPortalSessionsAction,
  revokePortalBookingTrustsAction,
} from '@/app/(customer-portal)/mina/actions'
import type {
  PortalBookingTrustDevice,
  PortalSessionDevice,
} from '@/lib/customer-portal/security-devices'

function DeviceIcon({ trust = false }: { trust?: boolean }) {
  return (
    <svg className="cp-icon cp-security-device-icon" viewBox="0 0 24 24" aria-hidden="true">
      {trust ? (
        <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 18h4M9 7l2 2 4-4" /></>
      ) : (
        <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 22h8M12 18v4" /></>
      )}
    </svg>
  )
}

function lastSeen(value: string, locale: string, timezone: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export function SecurityDevicesPanel({
  locale,
  timezone,
  sessions: initialSessions,
  bookingTrusts: initialBookingTrusts,
}: {
  locale: string
  timezone: string
  sessions: PortalSessionDevice[]
  bookingTrusts: PortalBookingTrustDevice[]
}) {
  const [sessions, setSessions] = useState(initialSessions)
  const [bookingTrusts, setBookingTrusts] = useState(initialBookingTrusts)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function revokeOtherSessions() {
    if (pending) return
    setMessage(null)
    startTransition(async () => {
      const result = await revokeOtherPortalSessionsAction()
      if (result.outcome !== 'success') {
        setMessage('Enheterna kunde inte loggas ut. Försök igen.')
        return
      }
      setSessions((current) => current.filter((session) => session.isCurrent))
      setMessage(result.count > 0 ? 'Andra enheter är utloggade.' : 'Inga andra enheter var inloggade.')
    })
  }

  function revokeBookingTrusts() {
    if (pending) return
    setMessage(null)
    startTransition(async () => {
      const result = await revokePortalBookingTrustsAction()
      if (result.outcome !== 'success') {
        setMessage('PIN-kravet kunde inte ändras. Försök igen.')
        return
      }
      setBookingTrusts([])
      setMessage('PIN krävs nästa gång på de återkallade bokningsenheterna.')
    })
  }

  return (
    <section className="cp-screen cp-security-screen">
      <p className="cp-page-kicker">SÄKERHET</p>
      <h1>Säkerhet och enheter</h1>
      <p className="cp-page-intro">Se var portalen är öppen och återkalla PIN-fria bokningsenheter.</p>

      <section className="cp-security-section" aria-labelledby="portal-enheter">
        <h2 id="portal-enheter">Inloggade enheter</h2>
        <div className="cp-security-list">
          {sessions.map((session, index) => (
            <article className="cp-security-device" key={`${session.label}-${session.createdAt}-${index}`}>
              <span className="cp-security-icon-wrap"><DeviceIcon /></span>
              <span className="cp-security-copy">
                <strong>{session.label}</strong>
                <span>Senast aktiv {lastSeen(session.lastSeenAt, locale, timezone)}</span>
              </span>
              {session.isCurrent && <span className="cp-pill cp-positive">Den här</span>}
            </article>
          ))}
        </div>
        {sessions.some((session) => !session.isCurrent) && (
          <button
            className="cp-btn cp-security-action"
            type="button"
            aria-disabled={pending ? 'true' : undefined}
            onClick={revokeOtherSessions}
          >
            Logga ut andra enheter
          </button>
        )}
      </section>

      <section className="cp-security-section" aria-labelledby="bokningsenheter">
        <h2 id="bokningsenheter">PIN-fria bokningsenheter</h2>
        {bookingTrusts.length > 0 ? (
          <>
            <div className="cp-security-list">
              {bookingTrusts.map((trust, index) => (
                <article className="cp-security-device" key={`${trust.label}-${trust.createdAt}-${index}`}>
                  <span className="cp-security-icon-wrap"><DeviceIcon trust /></span>
                  <span className="cp-security-copy">
                    <strong>{trust.label}</strong>
                    <span>Senast använd {lastSeen(trust.lastSeenAt, locale, timezone)}</span>
                  </span>
                </article>
              ))}
            </div>
            <button
              className="cp-btn cp-btn-danger cp-security-action"
              type="button"
              aria-disabled={pending ? 'true' : undefined}
              onClick={revokeBookingTrusts}
            >
              Kräv PIN nästa gång
            </button>
          </>
        ) : (
          <p className="cp-card cp-security-empty">Inga PIN-fria bokningsenheter är aktiva.</p>
        )}
      </section>

      {message && <p className="cp-security-message" role="status">{message}</p>}
    </section>
  )
}
