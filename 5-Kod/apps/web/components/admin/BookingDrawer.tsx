'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setBookingStatus, type ActionState } from '@/lib/admin/actions'
import { statusLabel, ALLOWED_FROM, type BookingStatus } from '@/lib/admin/format'
import { badgeClass } from '@/components/admin/badge'
import {
  Button,
  Callout,
  Modal,
  Icon,
  NotesThread,
  useToast,
  type ButtonVariant,
  type ThreadNote,
} from '@/components/portal/ui'
import type { BookingPaymentStatus } from '@/lib/admin/data'
import { moveBooking } from '@/lib/admin/calendar-actions'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import styles from './calendar.module.css'

/** Bokningsdrawern och dess delade format-/statushjälpare. Låg tidigare INNE i
 *  BookingsClient; lyft ut i goal-66 så kalenderarbetsbordet öppnar EXAKT samma yta
 *  med EXAKT samma statusregler. En bokning får inte kunna ändras på två sätt
 *  beroende på vilken vy man klickade från. */

/** One booking row, shaped by the server page from listBookings() + payment enrich. */
export type BookingRow = {
  id: string
  startTs: string
  endTs: string
  serviceName: string
  staffTitle: string
  /** Resursens id — kalendern placerar bokningen i rätt kolumn. */
  staffId: string
  /** Råa resurs-id:n behövs för att filtrera giltiga ombokningsval. */
  serviceId: string
  locationId: string
  priceCents: number | null
  status: string
  createdAt: string
  /** The single shared bookings.note (no kund/staff channel exists in the schema). */
  note: string | null
  /** Kopplad kundprofil — null för gäst-/legacy-bokningar utan kundkoppling. */
  customerId: string | null
  /** Maskerat visningsnamn (samma privacy-regel som Kunder-sidan), null = gäst. */
  customerName: string | null
  /** Kundens telefon — ringbar direkt (tel:) ur kalendern och drawern. */
  customerPhone: string | null
  /** Platsens namn — visas bara när tenanten har >1 aktiv plats. */
  locationName: string | null
  /** Derived server-side: the slot's start instant is already in the past. */
  isPast: boolean
  /** REAL Stripe-mirrored payment state, or null when no payment row exists. */
  paymentStatus: BookingPaymentStatus | null
  paymentAmountCents: number | null
}

// ── Statusgrupper över DB:ns 5-statusspektrum. Ren mappning så varje vy är överens. ──
export const isBokad = (s: string) => s === 'pending' || s === 'confirmed'
export const isKlar = (s: string) => s === 'completed'
export const isAvbokad = (s: string) => s === 'cancelled' || s === 'no_show'

/** status → accentfärg. Avbokad→danger, klar→success, annars gold. Bäraren av
 *  betydelsen är ALDRIG färgen ensam — varje yta sätter också ikon/text. */
export function statusAccent(status: string): string {
  // Utebliven ≠ avbokad: avbokat är ett besked i tid, uteblivet är en förlust. Egen
  // accent (warning) — men färgen bär aldrig ensam: kortet sätter ikon (clock) + texten
  // "Uteblev", drawern sätter badge + statusrad.
  if (status === 'no_show') return 'var(--c-warning)'
  if (isAvbokad(status)) return 'var(--c-danger)'
  if (isKlar(status)) return 'var(--c-success)'
  return 'var(--c-gold)'
}

// tz-ankrade formatterare (browser Intl — klientruntime, DST-säkra).
export const dayKey = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts))
export const dayLabel = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(ts))
export const timeLabel = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
    new Date(ts),
  )

/** En vald lokal väggtid blir ett UTC-instant med bokningsmotorns egen DST-säkra
 * konvertering. Omboka får aldrig anta att Stockholm alltid är UTC+1/+2. */
export const rescheduleStartIso = (date: string, time: string, tz: string) =>
  zonedTimeToUtc(date, time, tz).toISOString()

export function eligibleRescheduleStaff<
  T extends {
    id: string
    name: string
    serviceIds: readonly string[]
    locationIds: readonly string[]
  },
>(staff: readonly T[], serviceId: string, locationId: string): T[] {
  return staff.filter(
    (person) => person.serviceIds.includes(serviceId) && person.locationIds.includes(locationId),
  )
}
export const priceLabel = (cents: number | null) =>
  cents == null ? '—' : `${(cents / 100).toLocaleString('sv-SE')} kr`

/** Real payment label from the enriched row — never a fabricated "Betald". */
export function paymentLabel(row: BookingRow): string {
  switch (row.paymentStatus) {
    case 'succeeded':
      return row.paymentAmountCents != null
        ? `Betald · ${priceLabel(row.paymentAmountCents)}`
        : 'Betald'
    case 'pending':
      return 'Betalning påbörjad'
    case 'failed':
      return 'Betalning misslyckades'
    default:
      return 'Vid besök'
  }
}

function DetailPair({ label, value, num }: { label: string; value: string; num?: boolean }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 3 }}>
        {label}
      </div>
      <div className={num ? 'num' : undefined} style={{ fontSize: 14, color: 'var(--c-ink)' }}>
        {value}
      </div>
    </div>
  )
}

/**
 * Status-aware action set, gated on the REAL ALLOWED_FROM transition matrix so we
 * never render a button the server would reject:
 *  - Avbokad OCH Uteblev går att ångra (B-24) — samma väg tillbaka: `confirmed`.
 *    Servern kan ändå säga nej (återbetald bokning, krock med en nyare tid); knappen
 *    lovar ingenting, den skickar frågan.
 *  - "Markera betald" är UTELÄMNAD — betalningar präglas av Stripe; en manuell
 *    markering skulle desynka den verkliga betalstatusen.
 */
type DrawerAction = {
  label: string
  target: BookingStatus
  variant: ButtonVariant
  icon: 'check' | 'x' | 'undo' | 'clock'
  danger?: boolean
}

/** `isPast` = bokningens starttid har passerat. "Uteblev" visas BARA då — en tid som
 *  inte har börjat kan inte ha uteblivit (samma vakt står på servern; knappen är
 *  bekvämlighet, inte regeln). Inget bekräftelsesteg: klicket är ångerbart (Öppna
 *  igen), och en dialog för varje felklick är dyrare än ångern. */
function actionsFor(status: string, isPast: boolean): DrawerAction[] {
  const can = (target: BookingStatus) =>
    (ALLOWED_FROM[target] as readonly string[]).includes(status)
  const out: DrawerAction[] = []
  if (isBokad(status)) {
    if (can('cancelled'))
      out.push({ label: 'Avboka', target: 'cancelled', variant: 'ghost', icon: 'x', danger: true })
    if (isPast && can('no_show'))
      out.push({ label: 'Uteblev', target: 'no_show', variant: 'ghost', icon: 'clock' })
    if (isPast && can('completed'))
      out.push({ label: 'Markera klar', target: 'completed', variant: 'primary', icon: 'check' })
  } else if (isKlar(status) || status === 'no_show') {
    if (can('confirmed'))
      out.push({ label: 'Öppna igen', target: 'confirmed', variant: 'ghost', icon: 'undo' })
  } else if (status === 'cancelled') {
    // "Återställ", inte "Öppna igen": det är ett ÅNGRA, och ordet ska säga det.
    if (can('confirmed'))
      out.push({
        label: 'Återställ bokningen',
        target: 'confirmed',
        variant: 'ghost',
        icon: 'undo',
      })
  }
  return out
}

/** Numret som `tel:`-URI. Siffror och ett ledande plus överlever; mellanslag,
 *  bindestreck och parenteser bryter tel: i vissa telefonappar och rensas bort.
 *  Ett plus MITT i numret är inte ett landsprefix utan ett skrivfel — det ryker med.
 *  Returnerar null när det inte finns något att ringa. */
export function telHref(phone: string | null | undefined): string | null {
  const raw = phone?.trim()
  if (!raw) return null
  const plus = raw.startsWith('+') ? '+' : ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  return `tel:${plus}${digits}`
}

/** Ringbart nummer. `tel:` är plattformens egen mekanism — iOS/Android/desktop öppnar
 *  sin telefonapp med numret ifyllt, utan en rad JavaScript. Numret VISAS som ägaren
 *  skrev det; bara href:en normaliseras. */
function PhoneLink({ phone }: { phone: string | null }) {
  const raw = phone?.trim()
  const href = telHref(raw)
  if (!raw || !href) return null
  return (
    <a
      href={href}
      className="pbtn pbtn--ghost pbtn--sm num"
      aria-label={`Ring ${raw}`}
      style={{ whiteSpace: 'nowrap' }}
    >
      <Icon name="phone" size={15} />
      {raw}
    </a>
  )
}

export function BookingDrawer({
  booking,
  tz,
  onClose,
  staffNoun,
  staffColor,
  staff,
  onlinePaymentsActive,
  canManage,
  absenceTimeOffId,
}: {
  booking: BookingRow
  tz: string
  onClose: () => void
  staffNoun: string
  /** Personens kalenderfärg (hex) — pricken i dialogens hero. Serverhärledd via kalendern. */
  staffColor?: string
  /** Redan tenant-/platsfiltrerade resurser som bokningen faktiskt kan flyttas till. */
  staff: ReadonlyArray<{ id: string; name: string }>
  /** Sann endast när ägartoggle + Stripe charges_enabled båda är aktiva. */
  onlinePaymentsActive: boolean
  canManage: boolean
  /** Satt när bokningen öppnats från en frånvarokö. */
  absenceTimeOffId?: string | null
}) {
  const { notify } = useToast()
  const router = useRouter()
  const defaultRescheduleStaffId = staff.some((person) => person.id === booking.staffId)
    ? booking.staffId
    : (staff[0]?.id ?? '')
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setBookingStatus, {})
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleStaffId, setRescheduleStaffId] = useState(defaultRescheduleStaffId)
  const [rescheduleDate, setRescheduleDate] = useState(() => dayKey(booking.startTs, tz))
  const [rescheduleTime, setRescheduleTime] = useState(() => timeLabel(booking.startTs, tz))
  const [moveError, setMoveError] = useState<string | null>(null)
  const [moving, startMove] = useTransition()
  const rescheduleFirstFieldRef = useRef<HTMLSelectElement>(null)
  const rescheduleTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setRescheduling(false)
    setRescheduleStaffId(defaultRescheduleStaffId)
    setRescheduleDate(dayKey(booking.startTs, tz))
    setRescheduleTime(timeLabel(booking.startTs, tz))
    setMoveError(null)
  }, [booking.id, booking.startTs, defaultRescheduleStaffId, tz])

  useEffect(() => {
    if (rescheduling) rescheduleFirstFieldRef.current?.focus()
  }, [rescheduling])

  useEffect(() => {
    // Key on the whole `state` object: useActionState returns a FRESH reference per
    // dispatch, but setBookingStatus returns an IDENTICAL success string each time —
    // keying on state.success would skip the effect on a 2nd consecutive action
    // (klar → öppna igen), dropping its toast + refresh.
    if (state.success) {
      // Servern äger meddelandet. Drawern kastade förut serverns svar och hittade på en
      // egen mening ("… speglas på storefront, personal och översikt") — en rad ingen
      // läser, och två sanningar om samma händelse som kan glida isär. (E2E-granskning.)
      notify(state.success, 'success')
      router.refresh()
    }
    if (state.error) notify(state.error, 'warning')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const actions = canManage ? actionsFor(booking.status, booking.isPast) : []
  // En avbokad tid i det FÖRFLUTNA kan inte återställas — det vore att boka in någon
  // igår. (no_show får däremot rättas bakåt: "hen kom visst" är en korrigering av
  // historien, inte en ny bokning.) Samma regel som ångraloggen.
  const restoreBlockedPast = booking.status === 'cancelled' && booking.isPast
  const showAutoKlar = booking.isPast && isBokad(booking.status)
  // Payment-guard: en ej betald, ej avbokad bokning får ALDRIG auto-markeras
  // "klar + betald" (sen kund / no-show).
  const showPaymentGuard =
    onlinePaymentsActive && booking.paymentStatus !== 'succeeded' && !isAvbokad(booking.status)
  const canReschedule = canManage && isBokad(booking.status) && staff.length > 0

  const submitReschedule = () => {
    if (!rescheduleStaffId || !rescheduleDate || !rescheduleTime) {
      setMoveError('Välj person, datum och tid.')
      return
    }
    setMoveError(null)
    startMove(async () => {
      const result = await moveBooking({
        bookingId: booking.id,
        staffId: rescheduleStaffId,
        startIso: rescheduleStartIso(rescheduleDate, rescheduleTime, tz),
        locationId: booking.locationId,
        serviceId: booking.serviceId,
        expectedStartIso: booking.startTs,
        expectedStaffId: booking.staffId,
        absenceTimeOffId: absenceTimeOffId || undefined,
      })
      if (result.error) {
        setMoveError(result.error)
        return
      }
      notify(result.success ?? 'Bokningen är flyttad.', 'success')
      router.refresh()
      onClose()
    })
  }

  const notes: ThreadNote[] =
    booking.note && booking.note.trim() !== ''
      ? [{ id: booking.id, from: 'system', text: booking.note, meta: 'Notering mot bokningen' }]
      : []

  return (
    <Modal
      // v2-hero: stor mono-tid + tjänst leder, personprick + "hos X · dag" + status i
      // accent-raden. All övrig info (betalning/bokad-den/status) ligger kvar i kroppen.
      title={
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span
            className="num"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600 }}
          >
            {timeLabel(booking.startTs, tz)}–{timeLabel(booking.endTs, tz)}
          </span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{booking.serviceName}</span>
        </span>
      }
      sub={`${Math.round(
        (new Date(booking.endTs).getTime() - new Date(booking.startTs).getTime()) / 60000,
      )} min · ${priceLabel(booking.priceCents)}`}
      accent={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            aria-hidden="true"
            style={{
              width: 9,
              height: 9,
              borderRadius: 999,
              background: staffColor ?? 'var(--c-ink-3)',
            }}
          />
          <span style={{ color: 'var(--c-ink-2)', fontSize: 12.5 }}>
            hos {booking.staffTitle} · {dayLabel(booking.startTs, tz)}
          </span>
          <span className={badgeClass(booking.status)}>{statusLabel(booking.status)}</span>
        </span>
      }
      onClose={onClose}
      ariaLabel={`Bokning ${booking.serviceName}`}
      footer={
        rescheduling ? (
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRescheduling(false)
                setMoveError(null)
                window.requestAnimationFrame(() => rescheduleTriggerRef.current?.focus())
              }}
              disabled={moving}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              icon="calendar"
              onClick={submitReschedule}
              disabled={moving}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {moving ? 'Flyttar…' : 'Flytta bokningen'}
            </Button>
          </div>
        ) : restoreBlockedPast ? (
          <Callout tone="info" icon="shield">
            Tiden har passerat — en avbokad tid kan bara återställas medan den ligger framåt.
            Bokningen raderas aldrig och finns kvar i ångraloggen; skapa en ny tid vid behov.
          </Callout>
        ) : actions.length > 0 || canReschedule ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%' }}>
            {canReschedule && (
              <Button
                buttonRef={rescheduleTriggerRef}
                type="button"
                variant="ghost"
                icon="calendar"
                onClick={() => setRescheduling(true)}
                style={{ flex: '1 1 120px', justifyContent: 'center' }}
              >
                Omboka
              </Button>
            )}
            {actions.map((a) => (
              <form
                key={a.target}
                action={formAction}
                style={{ flex: '1 1 120px', display: 'flex' }}
              >
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="status" value={a.target} />
                <Button
                  variant={a.variant}
                  type="submit"
                  icon={a.icon}
                  disabled={pending}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    ...(a.danger
                      ? { color: 'var(--c-danger)', borderColor: 'var(--c-danger)' }
                      : {}),
                  }}
                >
                  {a.label}
                </Button>
              </form>
            ))}
          </div>
        ) : null
      }
    >
      <div style={{ display: 'grid', gap: 18 }}>
        {rescheduling && (
          <section
            style={{
              display: 'grid',
              gap: 12,
              padding: 14,
              border: '1px solid var(--c-line)',
              borderRadius: 14,
              background: 'var(--c-paper-2)',
            }}
          >
            <div className="eyebrow">Omboka</div>
            <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'var(--c-ink-2)' }}>
              {staffNoun}
              <select
                ref={rescheduleFirstFieldRef}
                className={styles.input}
                value={rescheduleStaffId}
                onChange={(event) => setRescheduleStaffId(event.target.value)}
              >
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.twoCol} style={{ marginTop: 0 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'var(--c-ink-2)' }}>
                Datum
                <input
                  className={styles.input}
                  type="date"
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'var(--c-ink-2)' }}>
                Tid
                <input
                  className={styles.input}
                  type="time"
                  step={900}
                  value={rescheduleTime}
                  onChange={(event) => setRescheduleTime(event.target.value)}
                />
              </label>
            </div>
            {moveError && (
              <Callout tone="warning" icon="alert">
                {moveError}
              </Callout>
            )}
          </section>
        )}

        {showAutoKlar && (
          <Callout tone="info" icon="clock">
            Tiden har passerat. Markeras <b>auto-klar</b> ikväll om du inte gör det själv —
            bokningen försvinner aldrig.
          </Callout>
        )}
        {showPaymentGuard && (
          <Callout tone="warning" icon="shield">
            En sen kund eller no-show markeras <b>aldrig</b> automatiskt som klar + betald.
            Betalningsstatus speglas från Stripe — aldrig manuellt påhittad.
          </Callout>
        )}

        {/* Kund — maskerat visningsnamn, länk till kundkortet, och RINGA. Telefonen är
            hela poängen med att öppna en bokning i farten: "hen är sen — ring".
            Numret är en tel:-länk, så ett tryck på iPaden/mobilen lämnar över till
            telefonappen med numret redan ifyllt. */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Kund
          </div>
          {booking.customerId ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '12px 14px',
                background: 'var(--c-paper-2)',
                borderRadius: 12,
                flexWrap: 'wrap',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  flex: 'none',
                  borderRadius: 999,
                  background: 'var(--c-paper)',
                  border: '1px solid var(--c-line)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--c-forest)',
                }}
              >
                {(booking.customerName?.trim() || 'G')[0]!.toUpperCase()}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-ink)', flex: 1 }}>
                {booking.customerName?.trim() || 'Gäst'}
              </span>
              <Link
                href={`/admin/kunder/${booking.customerId}`}
                className="pbtn pbtn--ghost pbtn--sm"
              >
                <Icon name="user" size={15} />
                Öppna kundkort
              </Link>

              <PhoneLink phone={booking.customerPhone} />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 11,
                padding: '12px 14px',
                background: 'var(--c-paper-2)',
                borderRadius: 12,
              }}
            >
              <Icon
                name="info"
                size={16}
                style={{ color: 'var(--c-ink-3)', flex: 'none', marginTop: 1 }}
              />
              <span style={{ fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.45 }}>
                Bokningen saknar kopplad kundprofil (gäst- eller äldre bokning) — det finns inget
                kundkort att visa. Nya bokningar via storefronten kopplas automatiskt.
              </span>
            </div>
          )}
        </section>

        {/* Noteringen leder efter kunden (designen) — kundens meddelande är det man vill
            se innan man agerar. */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Noteringar mot bokningen
          </div>
          <NotesThread
            notes={notes}
            emptyText="Ingen notering på den här bokningen. Kundens meddelande vid bokning landar här."
          />
        </section>

        {/* Detaljer UNDER — tid/tjänst/pris/personal står redan i heron, så gridet bär
            bara det som inte visas där: betalning, när den bokades, status. Inget tappas
            (NOTES: viktigast först, resten kvar under). */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Detaljer
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <DetailPair label="Betalning" value={paymentLabel(booking)} num />
            <DetailPair
              label="Bokad den"
              value={`${dayLabel(booking.createdAt, tz)} ${timeLabel(booking.createdAt, tz)}`}
              num
            />
            <DetailPair label="Status" value={statusLabel(booking.status)} />
            <DetailPair label={staffNoun} value={booking.staffTitle} />
          </div>
        </section>

        {state.error && (
          <p className="auth-error" role="alert">
            {state.error}
          </p>
        )}
      </div>
    </Modal>
  )
}
