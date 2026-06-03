import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff, getMyServices } from '@/lib/personal/staff'
import { getStaffScheduleWithNotes, dayRangeUtc } from '@/lib/personal/calendar'
import { todayInTz, fmtTime, fmtDateHeading } from '@/lib/personal/format'
import { Calendar } from '@/components/personal/Calendar'
import { WalkInForm } from '@/components/personal/WalkInForm'
import { MarkDoneButton } from '@/components/personal/MarkDoneButton'
import { PageHead, Badge, Card } from '@/components/portal/ui'
import styles from '@/components/personal/personal.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Personal — idag' }

export default async function PersonalPage() {
  const user = await requirePortal('personal')
  const staff = await getMyStaff(user.id)

  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Personal" title="Idag" />
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Ingen personalprofil kopplad</p>
          <p className={styles.emptyHint}>
            Ditt konto är inte kopplat till en personalrad ännu. Kontakta salongsadmin så kopplas du
            till din profil — sedan dyker dina bokningar och tider upp här.
          </p>
        </div>
      </section>
    )
  }

  const primaryTz = staff[0]?.timeZone ?? 'Europe/Stockholm'
  const staffIds = staff.map((s) => s.id)
  const services = await getMyServices(staffIds)
  const today = todayInTz(primaryTz)

  // Frisörens "Idag" är EN levande dag-lista (mock §M5: hero → kort) — ingen
  // datum-/veckonavigering (det reviret bor på salongens Bokningar / Mitt schema).
  // En enda dagsläsning matar både badge-räknaren och listan, så siffran alltid
  // = synliga rader. Den recognition-berikade läsningen ger preferens-chips +
  // kund-noteringen per rad utan extra query (batchat i lib).
  const { fromUtc, toUtc } = dayRangeUtc(today, primaryTz)
  const todays = await getStaffScheduleWithNotes(staffIds, fromUtc, toUtc)

  // Avbokade rader hör inte till dagslistan (mock: mine = status !== "avbokad").
  // Listan + badgen driver från SAMMA filtrerade dag, precis som mockens `mine`.
  const dayBookings = todays.filter((b) => b.status !== 'cancelled')

  // "Nästa kund"-hero: första aktiva (ej bekräftad / bekräftad) bokning som ännu
  // inte passerat — annars första aktiva. Härleds ur samma dagslista, ingen query.
  const activeToday = dayBookings.filter((b) => b.status === 'pending' || b.status === 'confirmed')
  const now = Date.now()
  const next =
    activeToday
      .filter((b) => new Date(b.startTs).getTime() >= now)
      .sort((a, b) => (a.startTs < b.startTs ? -1 : 1))[0] ??
    activeToday[0] ??
    null

  // Hero display fields, derived ONLY from data already loaded above (no queries).
  // The name is shown only when the booking truly carries one — customerLabel is
  // already the resolved name / parsed guest name, and falls back to the generic
  // 'Kund' when there is none; we never render that generic placeholder as a name.
  const nextName = next && next.customerLabel !== 'Kund' ? next.customerLabel : null
  const nextDurationMin = next
    ? Math.max(0, Math.round((new Date(next.endTs).getTime() - new Date(next.startTs).getTime()) / 60000))
    : 0

  // Mock §M5 är EN dag-fokuserad kolumn vid maxWidth 720 (Staff.jsx rad 17):
  // PageHead (badge högerställd på titelraden) → "Nästa kund"-hero → dag-lista.
  const dayCount = dayBookings.length
  return (
    <section className="portal-section" style={{ maxWidth: 720 }}>
      {/* Eyebrow carries today's date (mock grammar: "tis 2 juni" over "Idag").
          Badgen renderas i PageHeads högerslot — på titelraden, exakt som mocken
          ({n} bokningar, utan "idag"-suffix så texten ryms och inte radbryter). */}
      <PageHead
        eyebrow={fmtDateHeading(today)}
        title="Idag"
        lede="Din dag, live. Tryck på en kund för att snabbt minnas vad ni gjort sist — så du har koll utan att leta."
      >
        <Badge tone="gold">
          {dayCount} {dayCount === 1 ? 'bokning' : 'bokningar'}
        </Badge>
      </PageHead>

      {/* "Nästa kund"-hero — inverted forest surface, gold eyebrow, big Playfair
          time, gold "Markera klar" (Staff.jsx 23–32). Text colours are set
          explicitly (the .h1/.body roles bake in dark ink, invisible on forest);
          all tokens resolve under the back-office [data-world] shell. The day list
          + per-row actions follow below — additive, not reduced. */}
      <Card
        pad={26}
        style={{
          background: 'var(--c-forest)',
          border: 'none',
          marginBottom: 26,
          color: 'var(--c-on-forest)',
        }}
      >
        {next ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span className="eyebrow" style={{ color: 'var(--c-gold)' }}>
                Nästa kund
              </span>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                <span
                  className="num"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 34,
                    lineHeight: 1,
                    color: 'var(--c-on-forest)',
                  }}
                >
                  {fmtTime(next.startTs, next.timeZone)}
                </span>
                {nextName ? (
                  <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--c-on-forest)' }}>
                    {nextName}
                  </span>
                ) : null}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--c-on-forest-2)' }}>
                {next.serviceName ?? 'Tjänst'}
                {nextDurationMin > 0 ? ` · ${nextDurationMin} min` : ''}
              </p>
            </div>
            <MarkDoneButton key={next.id} bookingId={next.id} />
          </div>
        ) : (
          <div>
            <span className="eyebrow" style={{ color: 'var(--c-gold)' }}>
              Nästa kund
            </span>
            <p
              style={{
                margin: '8px 0 0',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 24,
                lineHeight: 1.15,
                color: 'var(--c-on-forest)',
              }}
            >
              Inga fler kunder idag
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--c-on-forest-2)' }}>
              Du är ikapp — njut av lugnet.
            </p>
          </div>
        )}
      </Card>

      {/* Walk-in (drop-in) — shipped capability the day-mock saknar (createWalkIn
          är verklig: insert på egen staff_id, no_double_booking-vakt). Behålls och
          restylas till en liten, högerställd åtgärd ovanför listan, utan extra
          eyebrow/datum-nav (det reviret hör till salongens Bokningar). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <WalkInForm services={services} timeZone={primaryTz} />
      </div>

      {/* EN levande dag-lista (mock §M5) — inga datum-rubriker, ingen vecko-vy. */}
      <Calendar bookings={dayBookings} />
    </section>
  )
}
