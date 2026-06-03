import type { StaffScheduleEntry } from '@/lib/personal/calendar'
import { fmtTime, statusLabel } from '@/lib/personal/format'
import { Card, Icon } from '@/components/portal/ui'
import { BookingStatusActions } from './BookingStatusActions'
import { ClientCard } from './ClientCard'
import styles from './personal.module.css'

const ACTIVE = new Set(['pending', 'confirmed'])

/** Minutes between start/end, floored at 0. */
function durationMin(b: StaffScheduleEntry): number {
  return Math.max(0, Math.round((new Date(b.endTs).getTime() - new Date(b.startTs).getTime()) / 60000))
}

/**
 * Frisörens dag-lista (M5 §3, Staff.jsx StaffToday). EN levande dag — ingen
 * datum-rubrik, ingen vecko-bucket (det reviret bor på salongens Bokningar /
 * Mitt schema). Varje rad är ett paper-Card med Playfair-tid + längd till vänster,
 * en 3px lodrät accent-list (guld medan bokningen är aktiv, grön när den är
 * klar/genomförd), kundens namn, upp till två VERKLIGA preferens-chips
 * (customer_notes.preferences via getStaffScheduleWithNotes), tjänsten och en
 * meddelande-ikon + inline guld-band när kunden lämnat en notering. Namnet öppnar
 * igenkännings-drawern (ClientCard). Aktiva rader behåller de operativa kontrollerna
 * (genomförd / uteblev / omboka / avboka) — shippad funktion som dag-mocken saknar.
 *
 * Två ärlighets-noteringar (ingen fejk — se goal-17-manifestets flaggor):
 *  • Stamkund-pillen: mocken härleder den ur visits>=5, men visits = GENOMFÖRDA
 *    besök och det finns ingen batchad per-dag-läsning för den (bara getCustomerCard,
 *    en tung enskild läsning). Den visas i igenkännings-drawern där siffran är
 *    verklig; raden utelämnar pillen hellre än fejkar den ur totalBookings.
 *  • "betald": ingen getBookingPaymentStatus-läsning finns i (frysta) datalagret,
 *    så raden visar bara bokningens STATUS ("Genomförd"), aldrig ett obackat
 *    "· betald".
 */
export function Calendar({ bookings }: { bookings: StaffScheduleEntry[] }) {
  if (bookings.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Inga bokningar idag</p>
        <p className={styles.emptyHint}>Dagen är fri – inga inbokade kunder.</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {bookings.map((b) => (
        <Row key={b.id} b={b} />
      ))}
    </div>
  )
}

function Row({ b }: { b: StaffScheduleEntry }) {
  const isActive = ACTIVE.has(b.status)
  const isDone = b.status === 'completed'
  const dur = durationMin(b)
  const prefs = b.customerPrefs.slice(0, 2)
  // The booking note is the customer-channel message — but for unlinked guests it
  // carries the "Gäst: <name> <email>" contact seam, NOT a message. Only surface
  // the note band when the row is a linked customer (FAS0 PII guard).
  const kundNote = b.customerId && b.customerNote ? b.customerNote : null

  return (
    <Card pad={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18 }}>
        {/* time + duration */}
        <div style={{ textAlign: 'center', minWidth: 58, flex: 'none' }}>
          <div
            className="num"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--c-forest)',
              lineHeight: 1.05,
            }}
          >
            {fmtTime(b.startTs, b.timeZone)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--c-ink-3)', marginTop: 2 }}>
            {dur > 0 ? `${dur} min` : '—'}
          </div>
        </div>

        {/* 3px accent rail — gold while active, green once klar */}
        <div
          aria-hidden="true"
          style={{
            width: 3,
            alignSelf: 'stretch',
            borderRadius: 999,
            flex: 'none',
            background: isDone ? 'var(--c-success)' : isActive ? 'var(--c-gold)' : 'var(--c-line-strong)',
          }}
        />

        {/* customer + prefs + service */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--c-ink)' }}>
            {b.customerId ? (
              <ClientCard
                customerId={b.customerId}
                label={b.customerLabel}
                bookingNote={b.customerNote}
              />
            ) : (
              b.customerLabel
            )}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--c-ink-2)', marginTop: 2 }}>
            {b.serviceName ?? 'Tjänst'}
          </div>
          {prefs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {prefs.map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: 11.5,
                    color: 'var(--c-ink-2)',
                    background: 'var(--c-paper-2)',
                    borderRadius: 999,
                    padding: '3px 9px',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* customer-note glyph */}
        {kundNote && (
          <Icon name="message" size={16} style={{ color: 'var(--c-gold-600)', flex: 'none' }} />
        )}

        {/* status (no unbacked "betald") */}
        <span className={`${styles.badge} ${badgeClass(b.status)}`}>{statusLabel(b.status)}</span>
      </div>

      {/* inline customer-note band — gold-tinted, like the mock's kund-note row */}
      {kundNote && (
        <div
          style={{
            borderTop: '1px solid var(--c-line)',
            padding: '12px 18px',
            background: 'var(--c-gold-100)',
            display: 'flex',
            gap: 10,
          }}
        >
          <Icon
            name="message"
            size={15}
            style={{ color: 'var(--c-gold-600)', flex: 'none', marginTop: 1 }}
          />
          <div>
            <div style={{ fontSize: 13, color: 'var(--c-ink)', lineHeight: 1.45 }}>{kundNote}</div>
            <div style={{ fontSize: 11, color: 'var(--c-ink-3)', marginTop: 2 }}>
              Från {b.customerLabel}
            </div>
          </div>
        </div>
      )}

      {/* operative actions for still-active bookings */}
      {isActive && (
        <div style={{ borderTop: '1px solid var(--c-line)', padding: '12px 18px' }}>
          <BookingStatusActions bookingId={b.id} timeZone={b.timeZone} />
        </div>
      )}
    </Card>
  )
}

function badgeClass(status: string): string {
  const key = `badge${status.charAt(0).toUpperCase()}${status.slice(1)}`
  return styles[key] ?? ''
}
