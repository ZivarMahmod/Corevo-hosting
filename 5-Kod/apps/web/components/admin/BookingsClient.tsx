'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setBookingStatus, type ActionState } from '@/lib/admin/actions'
import { statusLabel, BOOKING_STATUSES } from '@/lib/admin/format'
import { badgeClass } from '@/components/admin/badge'
import {
  Button,
  Callout,
  Drawer,
  ViewSwitcher,
  usePersistentView,
  useToast,
  type ViewOption,
} from '@/components/portal/ui'

/** One booking row, shaped by the server page from listBookings(). */
export type BookingRow = {
  id: string
  startTs: string
  serviceName: string
  staffTitle: string
  priceCents: number | null
  status: string
  createdAt: string
}

type View = 'lista' | 'vecka'
const VIEWS: View[] = ['lista', 'vecka']
const VIEW_OPTIONS: ViewOption<View>[] = [
  { value: 'lista', label: 'Lista', icon: 'menu' },
  { value: 'vecka', label: 'Vecka', icon: 'calendar' },
]

// tz-anchored formatters (browser Intl — client runtime, DST-safe).
const dayKey = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(ts),
  )
const dayLabel = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(ts),
  )
const timeLabel = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
const priceLabel = (cents: number | null) =>
  cents == null ? '—' : `${(cents / 100).toLocaleString('sv-SE')} kr`

/**
 * Bokningar interaction island (playbook §4.6) — the client surface over the
 * server-fetched bookings: a röd-tråd guard-band, a Lista/Vecka view-switcher
 * (persisted), and a shared detail Drawer whose status change fires the
 * consequence Toast + refreshes every surface. The server page owns the data
 * fetch + filters; this owns the composition + interaction.
 */
export function BookingsClient({ bookings, tz }: { bookings: BookingRow[]; tz: string }) {
  const [view, setView] = usePersistentView<View>('corevo.bookings.view', VIEWS, 'lista')
  const [selected, setSelected] = useState<BookingRow | null>(null)

  return (
    <>
      <Callout tone="gold" icon="link">
        Allt här speglas live mot din publika sajt — när en kund avbokar frigörs tiden automatiskt och
        bokningen markeras avbokad, aldrig raderad.
      </Callout>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          margin: '16px 0',
          flexWrap: 'wrap',
        }}
      >
        <ViewSwitcher options={VIEW_OPTIONS} value={view} onChange={setView} ariaLabel="Vy" />
        <span className="num" style={{ color: 'var(--c-ink-3)', fontSize: 13, fontWeight: 600 }}>
          {bookings.length} bokningar
        </span>
      </div>

      {view === 'lista' ? (
        <ListaView bookings={bookings} tz={tz} onSelect={setSelected} />
      ) : (
        <VeckaView bookings={bookings} tz={tz} onSelect={setSelected} />
      )}

      {selected && <BookingDrawer booking={selected} tz={tz} onClose={() => setSelected(null)} />}
    </>
  )
}

function ListaView({
  bookings,
  tz,
  onSelect,
}: {
  bookings: BookingRow[]
  tz: string
  onSelect: (b: BookingRow) => void
}) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--c-line)', borderRadius: 16 }}>
      <table className="ptable">
        <thead>
          <tr>
            <th>Tid</th>
            <th>Tjänst</th>
            <th>Medarbetare</th>
            <th>Pris</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr
              key={b.id}
              onClick={() => onSelect(b)}
              style={{ cursor: 'pointer' }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(b)
                }
              }}
              role="button"
              aria-label={`Öppna ${b.serviceName} ${dayLabel(b.startTs, tz)} ${timeLabel(b.startTs, tz)}`}
            >
              <td className="num">
                {dayLabel(b.startTs, tz)} {timeLabel(b.startTs, tz)}
              </td>
              <td style={{ fontWeight: 600 }}>{b.serviceName}</td>
              <td style={{ color: 'var(--c-ink-2)' }}>{b.staffTitle}</td>
              <td className="num">{priceLabel(b.priceCents)}</td>
              <td>
                <span className={badgeClass(b.status)}>{statusLabel(b.status)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VeckaView({
  bookings,
  tz,
  onSelect,
}: {
  bookings: BookingRow[]
  tz: string
  onSelect: (b: BookingRow) => void
}) {
  // Group by calendar day (tz-anchored), chronological columns.
  const byDay = new Map<string, BookingRow[]>()
  for (const b of bookings) {
    const k = dayKey(b.startTs, tz)
    const arr = byDay.get(k)
    if (arr) arr.push(b)
    else byDay.set(k, [b])
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(180px, 1fr))`,
        gap: 12,
        overflowX: 'auto',
      }}
    >
      {days.map(([key, list]) => (
        <div
          key={key}
          style={{
            border: '1px solid var(--c-line)',
            borderRadius: 12,
            background: 'var(--c-paper)',
            minHeight: 320,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '12px 12px 10px',
              borderBottom: '1px solid var(--c-line)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--c-forest)',
                textTransform: 'capitalize',
              }}
            >
              {dayLabel(list[0]!.startTs, tz)}
            </div>
            <div className="num" style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 2 }}>
              {list.length} bokning{list.length === 1 ? '' : 'ar'}
            </div>
          </div>
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {list
              .slice()
              .sort((a, b) => (a.startTs < b.startTs ? -1 : 1))
              .map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelect(b)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid var(--c-line)',
                    borderRadius: 9,
                    background: 'var(--c-paper-2)',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-forest)' }}>
                    {timeLabel(b.startTs, tz)}
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--c-ink)' }}>{b.serviceName}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--c-ink-3)' }}>{b.staffTitle}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
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

function BookingDrawer({ booking, tz, onClose }: { booking: BookingRow; tz: string; onClose: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setBookingStatus, {})

  useEffect(() => {
    if (state.success) {
      notify('Status uppdaterad — speglas på storefront, personal och översikt', 'success')
      router.refresh()
      onClose()
    }
    // fire once when the action reports success
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <Drawer
      title={booking.serviceName}
      sub={`${dayLabel(booking.startTs, tz)} ${timeLabel(booking.startTs, tz)} · ${booking.staffTitle}`}
      accent={<span className={badgeClass(booking.status)}>{statusLabel(booking.status)}</span>}
      onClose={onClose}
      ariaLabel={`Bokning ${booking.serviceName}`}
      footer={
        <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
          <input type="hidden" name="bookingId" value={booking.id} />
          <select
            name="status"
            defaultValue={booking.status}
            aria-label="Ändra status"
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 10,
              border: '1px solid var(--c-line)',
              background: 'var(--c-paper)',
              color: 'var(--c-ink)',
              fontFamily: 'var(--font-ui)',
              fontSize: 14,
            }}
          >
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <Button variant="primary" type="submit" icon="check" disabled={pending}>
            {pending ? '…' : 'Spara'}
          </Button>
        </form>
      }
    >
      <div style={{ marginBottom: 6 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Detaljer
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <DetailPair label="Tid" value={`${dayLabel(booking.startTs, tz)} ${timeLabel(booking.startTs, tz)}`} num />
          <DetailPair label="Pris" value={priceLabel(booking.priceCents)} num />
          <DetailPair label="Medarbetare" value={booking.staffTitle} />
          <DetailPair label="Bokad den" value={`${dayLabel(booking.createdAt, tz)} ${timeLabel(booking.createdAt, tz)}`} num />
        </div>
      </div>
      {state.error && (
        <p className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {state.error}
        </p>
      )}
    </Drawer>
  )
}
