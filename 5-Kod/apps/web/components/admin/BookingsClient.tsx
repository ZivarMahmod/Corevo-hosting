'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setBookingStatus, type ActionState } from '@/lib/admin/actions'
import { statusLabel, ALLOWED_FROM, type BookingStatus } from '@/lib/admin/format'
import { badgeClass } from '@/components/admin/badge'
import {
  Button,
  Callout,
  Drawer,
  Icon,
  NotesThread,
  ViewSwitcher,
  usePersistentView,
  useToast,
  type ButtonVariant,
  type ThreadNote,
  type ViewOption,
} from '@/components/portal/ui'
import type { BookingPaymentStatus } from '@/lib/admin/data'

/** One booking row, shaped by the server page from listBookings() + payment enrich. */
export type BookingRow = {
  id: string
  startTs: string
  endTs: string
  serviceName: string
  staffTitle: string
  priceCents: number | null
  status: string
  createdAt: string
  /** The single shared bookings.note (no kund/staff channel exists in the schema). */
  note: string | null
  /** Kopplad kundprofil — null för gäst-/legacy-bokningar utan kundkoppling. */
  customerId: string | null
  /** Maskerat visningsnamn (samma privacy-regel som Kunder-sidan), null = gäst. */
  customerName: string | null
  /** Platsens namn — visas bara när tenanten har >1 aktiv plats. */
  locationName: string | null
  /** Derived server-side: the slot's start instant is already in the past. */
  isPast: boolean
  /** REAL Stripe-mirrored payment state, or null when no payment row exists. */
  paymentStatus: BookingPaymentStatus | null
  paymentAmountCents: number | null
}

/** Per-weekday (0=Sun…6=Sat) raster for the Vecka grid, built server-side from the
 *  salon's working hours + slots. `closed` (no working_hours that day) → "Stängt";
 *  otherwise `slots` are the bookable start-times ("HH:MM") rendered as dashed
 *  "Ledig" cells. This is what fills the grid at zero bookings (the empty-state). */
export type WeekDayTemplate = { closed: boolean; slots: string[] }
export type WeekTemplate = Record<number, WeekDayTemplate>

type View = 'lista' | 'vecka'
const VIEWS: View[] = ['vecka', 'lista']
const VIEW_OPTIONS: ViewOption<View>[] = [
  { value: 'vecka', label: 'Vecka', icon: 'calendar' },
  { value: 'lista', label: 'Lista', icon: 'menu' },
]

// ── Status grouping (mock §4.6 pills: Bokade/Klara/Avbokade) over the real
//    5-status DB spectrum. "Bokade" = pending+confirmed, "Klara" = completed,
//    "Avbokade" = cancelled+no_show. A pure mapping so list + pills agree. ──
type StatusFilter = 'Alla' | 'Bokade' | 'Klara' | 'Avbokade'
const STATUS_FILTERS: StatusFilter[] = ['Alla', 'Bokade', 'Klara', 'Avbokade']
const isBokad = (s: string) => s === 'pending' || s === 'confirmed'
const isKlar = (s: string) => s === 'completed'
const isAvbokad = (s: string) => s === 'cancelled' || s === 'no_show'
const isDim = (s: string) => isAvbokad(s)
function matchesFilter(status: string, f: StatusFilter): boolean {
  if (f === 'Alla') return true
  if (f === 'Bokade') return isBokad(status)
  if (f === 'Klara') return isKlar(status)
  return isAvbokad(status)
}

// tz-anchored formatters (browser Intl — client runtime, DST-safe).
const dayKey = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(ts),
  )
const dayLabel = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(ts),
  )
const weekdayLabel = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: tz, weekday: 'short' }).format(new Date(ts))
const dayNumLabel = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: tz, day: 'numeric' }).format(new Date(ts))
const timeLabel = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
const priceLabel = (cents: number | null) =>
  cents == null ? '—' : `${(cents / 100).toLocaleString('sv-SE')} kr`

/** Real payment label from the enriched row — never a fabricated "Betald". */
function paymentLabel(row: BookingRow): string {
  switch (row.paymentStatus) {
    case 'succeeded':
      return row.paymentAmountCents != null ? `Betald · ${priceLabel(row.paymentAmountCents)}` : 'Betald'
    case 'pending':
      return 'Betalning påbörjad'
    case 'failed':
      return 'Betalning misslyckades'
    default:
      return 'Vid besök'
  }
}

/**
 * Bokningar interaction island (mock §4.6 + drawer §4.9). The client surface over
 * the server-fetched bookings: a live-coupling guard-band, a search + status-pill
 * filter row (live counts), a Vecka/Lista view-switcher (persisted), and a shared
 * detail Drawer whose status change fires the consequence Toast + refreshes every
 * surface. The server page owns the data fetch + range/staff filters + payment
 * enrich; this owns the composition + interaction.
 */
export function BookingsClient({
  bookings,
  weekBookings,
  weekAnchor,
  tz,
  weekTemplate,
  staffNoun = 'Personal',
  staffOptions = [],
  staffFilter = '',
  locationOptions = [],
  locationFilter = '',
  showLocation = false,
}: {
  /** Lista-vyns rader: kommande från idag (open-ended). */
  bookings: BookingRow[]
  /** Vecka-vyns rader: HELA den valda veckan (även bakåt = historik). */
  weekBookings: BookingRow[]
  /** Validerad 'YYYY-MM-DD' som ankrar Vecka-vyn (vilken dag i veckan som helst). */
  weekAnchor: string
  tz: string
  weekTemplate: WeekTemplate
  /** Bransch-noun for the staff column/label (resolved server-side). Default
   *  'Personal' so an unwired mount renders exactly today's text (DIFF-0). */
  staffNoun?: string
  staffOptions?: { id: string; name: string }[]
  /** Aktivt serverfilter ('' = Alla) — URL:en är sanningen, selecten speglar den. */
  staffFilter?: string
  locationOptions?: { id: string; name: string }[]
  locationFilter?: string
  /** true bara när tenanten har >1 aktiv plats — annars är plats-ytan osynlig. */
  showLocation?: boolean
}) {
  const router = useRouter()
  const [view, setView] = usePersistentView<View>('corevo.bookings.view', VIEWS, 'vecka')
  const [filter, setFilter] = useState<StatusFilter>('Alla')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<BookingRow | null>(null)

  // Server-filtren (vecka/personal/plats) bor i URL:en → en select-ändring är en
  // navigation, inte lokal state. Patch-semantik: undefined = behåll, '' = rensa.
  const buildHref = (patch: { week?: string; personal?: string; plats?: string }) => {
    const p = new URLSearchParams()
    p.set('week', patch.week ?? weekAnchor)
    const personal = patch.personal ?? staffFilter
    if (personal) p.set('personal', personal)
    const plats = patch.plats ?? locationFilter
    // Vid flera platser skrivs plats ALLTID explicit ('alla' = sentinel för Alla)
    // — annars skulle topbarens butik-cookie återta valet vid nästa navigation
    // (lib/admin/plats.ts); cookien gäller bara färsk entré utan params.
    if (plats) p.set('plats', plats)
    else if (showLocation) p.set('plats', 'alla')
    return `/admin/bokningar?${p.toString()}`
  }

  // Pillren + sökningen ska räkna/filtrera det man faktiskt TITTAR på — Lista och
  // Vecka har olika tidsfönster, så aktiv vy väljer dataset.
  const active = view === 'vecka' ? weekBookings : bookings

  const counts: Record<StatusFilter, number> = useMemo(
    () => ({
      Alla: active.length,
      Bokade: active.filter((b) => isBokad(b.status)).length,
      Klara: active.filter((b) => isKlar(b.status)).length,
      Avbokade: active.filter((b) => isAvbokad(b.status)).length,
    }),
    [active],
  )

  const term = q.trim().toLowerCase()
  const list = useMemo(
    () =>
      active
        .filter((b) => matchesFilter(b.status, filter))
        .filter(
          (b) =>
            term === '' ||
            b.serviceName.toLowerCase().includes(term) ||
            b.staffTitle.toLowerCase().includes(term) ||
            (b.customerName?.toLowerCase().includes(term) ?? false),
        )
        .slice()
        .sort((a, b) => (a.startTs < b.startTs ? -1 : 1)),
    [active, filter, term],
  )

  // Keep the open drawer's row in sync with refreshed server data (status change).
  // Drawern kan ha öppnats från endera vyn → leta i båda dataseten.
  const selectedLive = selected
    ? [...bookings, ...weekBookings].find((b) => b.id === selected.id) ?? null
    : null

  // ── Vecko-navigering (bara meningsfull i Vecka-vyn) ──────────────────────────
  const todayKey = dayKey(new Date().toISOString(), tz)
  const monday = mondayOf(weekAnchor)
  const sunday = addDaysKey(monday, 6)
  const isCurrentWeek = monday === mondayOf(todayKey)
  // Nyckeln är ett rent datum — formatera på UTC-noon så etiketten aldrig driver.
  const weekDayLabel = (key: string) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(
      new Date(`${key}T12:00:00Z`),
    )

  return (
    <>
      <Callout tone="gold" icon="repeat">
        Avbokar du en tid frigörs den automatiskt på storefronten — <b>prova:</b> öppna en bokad rad
        och tryck <b>Avboka</b>. Bokningen markeras avbokad, aldrig raderad.
      </Callout>

      {/* search + status-pills + view-switcher (mock §4.6 control row) */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          margin: '16px 0',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--c-ink-3)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Sök tjänst, ${staffNoun.toLowerCase()}…`}
            aria-label="Sök bokningar"
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: 10,
              border: '1px solid var(--c-line)',
              background: 'var(--c-paper)',
              fontFamily: 'var(--font-ui)',
              fontSize: 14,
              color: 'var(--c-ink)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        {STATUS_FILTERS.map((f) => {
          const isActive = filter === f
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={isActive}
              style={{
                padding: '9px 15px',
                borderRadius: 10,
                border: '1px solid var(--c-line)',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                fontSize: 13,
                fontWeight: 600,
                background: isActive ? 'var(--c-forest)' : 'var(--c-paper)',
                color: isActive ? '#fff' : 'var(--c-ink-2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              {f}
              <span className="num" style={{ fontSize: 11, opacity: 0.7 }}>
                {counts[f]}
              </span>
            </button>
          )
        })}
        {/* Serverfilter: personal + (vid flera platser) plats. En ändring är en
            URL-navigation — servern hämtar om BÅDA vyernas fönster med filtret. */}
        <FilterSelect
          ariaLabel={`Filtrera på ${staffNoun.toLowerCase()}`}
          value={staffFilter}
          allLabel={`${staffNoun}: alla`}
          options={staffOptions}
          onChange={(v) => router.push(buildHref({ personal: v }))}
        />
        {showLocation && (
          <FilterSelect
            ariaLabel="Filtrera på plats"
            value={locationFilter}
            allLabel="Plats: alla"
            options={locationOptions}
            onChange={(v) => router.push(buildHref({ plats: v }))}
          />
        )}
        <div style={{ marginLeft: 'auto' }}>
          <ViewSwitcher options={VIEW_OPTIONS} value={view} onChange={setView} ariaLabel="Vy" />
        </div>
      </div>

      {view === 'vecka' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '0 0 12px',
            flexWrap: 'wrap',
          }}
        >
          <Link href={buildHref({ week: addDaysKey(monday, -7) })} className="pbtn pbtn--ghost pbtn--sm">
            <Icon name="chevronLeft" size={15} />
            Föregående
          </Link>
          <Link
            href={buildHref({ week: todayKey })}
            className="pbtn pbtn--ghost pbtn--sm"
            aria-current={isCurrentWeek ? 'true' : undefined}
            style={isCurrentWeek ? { color: 'var(--c-forest)', fontWeight: 700 } : undefined}
          >
            Idag
          </Link>
          <Link href={buildHref({ week: addDaysKey(monday, 7) })} className="pbtn pbtn--ghost pbtn--sm">
            Nästa
            <Icon name="chevronRight" size={15} />
          </Link>
          <span className="num" style={{ fontSize: 13, color: 'var(--c-ink-2)', fontWeight: 600 }}>
            {weekDayLabel(monday)} – {weekDayLabel(sunday)}
            {isCurrentWeek ? ' · denna vecka' : ''}
          </span>
        </div>
      )}

      {view === 'lista' ? (
        <ListaView
          bookings={list}
          tz={tz}
          onSelect={setSelected}
          staffNoun={staffNoun}
          showLocation={showLocation}
        />
      ) : (
        <VeckaView
          bookings={list}
          tz={tz}
          monday={monday}
          todayKey={todayKey}
          weekTemplate={weekTemplate}
          onSelect={setSelected}
        />
      )}

      {selectedLive && (
        <BookingDrawer
          booking={selectedLive}
          tz={tz}
          onClose={() => setSelected(null)}
          staffNoun={staffNoun}
        />
      )}
    </>
  )
}

/** Styrd server-filter-select i kontrollradens grammatik (samma yta som sökfältet). */
function FilterSelect({
  ariaLabel,
  value,
  allLabel,
  options,
  onChange,
}: {
  ariaLabel: string
  value: string
  allLabel: string
  options: { id: string; name: string }[]
  onChange: (value: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      style={{
        padding: '9px 12px',
        borderRadius: 10,
        border: '1px solid var(--c-line)',
        background: 'var(--c-paper)',
        fontFamily: 'var(--font-ui)',
        fontSize: 13,
        fontWeight: 600,
        color: value ? 'var(--c-ink)' : 'var(--c-ink-2)',
        cursor: 'pointer',
        maxWidth: 200,
      }}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  )
}

/* ── Lista view (mock BkList): Tid · Kund · Tjänst · Frisör · [Plats ·] Pris · Status ── */
function ListaView({
  bookings,
  tz,
  onSelect,
  staffNoun,
  showLocation,
}: {
  bookings: BookingRow[]
  tz: string
  onSelect: (b: BookingRow) => void
  staffNoun: string
  showLocation: boolean
}) {
  if (bookings.length === 0) return <EmptyMatch />
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--c-line)', borderRadius: 16 }}>
      <table className="ptable">
        <thead>
          <tr>
            <th>Tid</th>
            <th>Kund</th>
            <th>Tjänst</th>
            <th>{staffNoun}</th>
            {showLocation && <th>Plats</th>}
            <th data-last="">Pris</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const dim = isDim(b.status)
            return (
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
                <td
                  className="num"
                  style={{
                    fontWeight: 700,
                    color: dim ? 'var(--c-ink-3)' : 'var(--c-forest)',
                    textDecoration: dim ? 'line-through' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dayLabel(b.startTs, tz)} {timeLabel(b.startTs, tz)}
                </td>
                <td>
                  <KundCell name={b.customerName} note={b.note} dim={dim} />
                </td>
                <td style={{ opacity: dim ? 0.6 : 1, fontWeight: 600 }}>{b.serviceName}</td>
                <td style={{ opacity: dim ? 0.6 : 1, color: 'var(--c-ink-2)' }}>{b.staffTitle}</td>
                {showLocation && (
                  <td style={{ opacity: dim ? 0.6 : 1, color: 'var(--c-ink-2)' }}>
                    {b.locationName ?? '—'}
                  </td>
                )}
                <td data-last="" className="num" style={{ opacity: dim ? 0.6 : 1 }}>
                  {priceLabel(b.priceCents)}
                </td>
                <td>
                  <span className={badgeClass(b.status)}>{statusLabel(b.status)}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Kund cell (mock: avatar initial + name + customer-note glyph). `name` är det
 * MASKERADE visningsnamnet från datalagret (samma privacy-regel som Kunder-sidan:
 * display_name → initial vid name_hidden → full_name) — ett dolt fullnamn kan
 * aldrig nå den här cellen. null = bokning utan kundkoppling → ärligt "Gäst".
 */
function KundCell({ name, note, dim }: { name: string | null; note: string | null; dim: boolean }) {
  const shown = name?.trim() || 'Gäst'
  const initial = name?.trim() ? shown[0]!.toUpperCase() : '·'
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 9, opacity: dim ? 0.6 : 1 }}>
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          flex: 'none',
          borderRadius: 999,
          background: 'var(--c-paper-2)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--c-forest)',
        }}
      >
        {initial}
      </span>
      <b style={{ fontWeight: 600, color: name ? 'var(--c-ink)' : 'var(--c-ink-2)' }}>{shown}</b>
      {note && note.trim() !== '' && (
        <Icon name="message" size={14} style={{ color: 'var(--c-gold-600)', flex: 'none' }} />
      )}
    </span>
  )
}

/* ── Vecka view (mock BkWeek): fixed Mon–Sun grid of the NAVIGATED week; today
      tinted gold when it faller i fönstret. Every day column renders the salon's
      slot raster (weekTemplate) as dashed "Ledig" cells; real bookings are placed
      into their matching time cell (else appended). A weekday with no published
      slots shows "Stängt". The raster IS the empty-state — it's what the salon
      sees live at zero bookings. ── */
function VeckaView({
  bookings,
  tz,
  monday,
  todayKey,
  weekTemplate,
  onSelect,
}: {
  bookings: BookingRow[]
  tz: string
  /** Måndagen ('YYYY-MM-DD') i den URL-valda veckan (?week=) — historik funkar. */
  monday: string
  todayKey: string
  weekTemplate: WeekTemplate
  onSelect: (b: BookingRow) => void
}) {
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i))

  const byDay = new Map<string, BookingRow[]>()
  for (const b of bookings) {
    const k = dayKey(b.startTs, tz)
    const arr = byDay.get(k)
    if (arr) arr.push(b)
    else byDay.set(k, [b])
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--c-line)', borderRadius: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(118px, 1fr))',
          minWidth: 760,
        }}
      >
        {weekKeys.map((key, idx) => {
          const dayList = (byDay.get(key) ?? [])
            .slice()
            .sort((a, b) => (a.startTs < b.startTs ? -1 : 1))
          const isToday = key === todayKey
          const noonIso = `${key}T12:00:00.000Z`
          const day = weekTemplate[weekdayOfKey(key)] ?? { closed: true, slots: [] }
          const slots = day.slots
          // Closed ONLY when the salon publishes no hours that weekday — never
          // inferred from missing slots (an open day with no explicit slots still
          // shows its derived "Ledig" raster, never a false "Stängt").
          const closed = day.closed

          // Place each booking at its start-time ("HH:MM"); the first booking on a
          // slot fills that cell, the rest (and any off-raster bookings) append.
          const atTime = new Map<string, BookingRow>()
          const extra: BookingRow[] = []
          for (const b of dayList) {
            const t = timeLabel(b.startTs, tz)
            if (slots.includes(t) && !atTime.has(t)) atTime.set(t, b)
            else extra.push(b)
          }

          return (
            <div
              key={key}
              style={{
                borderRight: idx < 6 ? '1px solid var(--c-line)' : 'none',
                minHeight: 440,
                background: closed ? 'var(--c-paper-2)' : 'transparent',
              }}
            >
              <div
                style={{
                  padding: '13px 10px',
                  borderBottom: '1px solid var(--c-line)',
                  textAlign: 'center',
                  background: isToday ? 'var(--c-gold-100)' : 'transparent',
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    color: isToday ? 'var(--c-gold-600)' : 'var(--c-ink-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                    fontWeight: 600,
                  }}
                >
                  {weekdayLabel(noonIso, tz)}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    fontWeight: 700,
                    color: isToday ? 'var(--c-forest)' : 'var(--c-ink)',
                    marginTop: 1,
                  }}
                  className="num"
                >
                  {dayNumLabel(noonIso, tz)}
                </div>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {closed && dayList.length === 0 && (
                  <div
                    style={{
                      padding: '16px 6px',
                      textAlign: 'center',
                      fontSize: 11.5,
                      color: 'var(--c-ink-3)',
                    }}
                  >
                    Stängt
                  </div>
                )}
                {slots.map((t) => {
                  const b = atTime.get(t)
                  return b ? (
                    <BookingCell key={t} booking={b} tz={tz} onSelect={onSelect} />
                  ) : (
                    <div
                      key={t}
                      style={{
                        padding: '7px 9px',
                        borderRadius: 9,
                        border: '1px dashed var(--c-line-strong)',
                      }}
                    >
                      <div
                        className="num"
                        style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--c-ink-3)' }}
                      >
                        {t}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--c-ink-3)', marginTop: 1 }}>
                        Ledig
                      </div>
                    </div>
                  )
                })}
                {extra.map((b) => (
                  <BookingCell key={b.id} booking={b} tz={tz} onSelect={onSelect} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* One placed booking inside a Vecka day column (mock BkWeek booked-slot cell). */
function BookingCell({
  booking: b,
  tz,
  onSelect,
}: {
  booking: BookingRow
  tz: string
  onSelect: (b: BookingRow) => void
}) {
  const dim = isDim(b.status)
  return (
    <button
      type="button"
      onClick={() => onSelect(b)}
      style={{
        textAlign: 'left',
        padding: '7px 9px',
        borderRadius: 9,
        border: '1px solid var(--c-line)',
        borderLeft: `3px solid ${statusAccent(b.status)}`,
        background: dim ? 'var(--c-paper-2)' : 'var(--c-paper)',
        cursor: 'pointer',
        opacity: dim ? 0.7 : 1,
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div
        className="num"
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: dim ? 'var(--c-ink-3)' : 'var(--c-forest)',
          textDecoration: dim ? 'line-through' : 'none',
        }}
      >
        {timeLabel(b.startTs, tz)}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: 'var(--c-ink)',
        }}
      >
        {b.serviceName}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--c-ink-3)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {b.staffTitle}
      </div>
    </button>
  )
}

function EmptyMatch() {
  return (
    <div
      style={{
        padding: 30,
        textAlign: 'center',
        color: 'var(--c-ink-3)',
        fontSize: 14,
        border: '1px solid var(--c-line)',
        borderRadius: 16,
        background: 'var(--c-paper)',
      }}
    >
      Inga bokningar matchar filtret.
    </div>
  )
}

/** status → left-rail accent (mock statusColor): avbokad→danger, klar→success, else gold. */
function statusAccent(status: string): string {
  if (isAvbokad(status)) return 'var(--c-danger)'
  if (isKlar(status)) return 'var(--c-success)'
  return 'var(--c-gold)'
}

// ── Week date math (pure, on 'YYYY-MM-DD' keys, UTC-noon anchored) ──
function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}
function mondayOf(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0))
  const dow = dt.getUTCDay() // 0 = Sun
  const delta = dow === 0 ? -6 : 1 - dow
  return addDaysKey(key, delta)
}
/** Weekday 0=Sun…6=Sat of a 'YYYY-MM-DD' key — matches working_hours.weekday
 *  (lib/booking/tz weekdayOf), noon-anchored so no DST edge shifts the day. */
function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0)).getUTCDay()
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
 * Status-aware action set (mock BookingActions) gated on the REAL ALLOWED_FROM
 * transition matrix so we never render a button that the server would reject:
 *  - Avbokad/Uteblev are TERMINAL sources in zero target lists → no "Återställ"
 *    button (it would always be "Otillåten statusövergång"); show an explainer.
 *  - "Markera betald" is OMITTED — payments are Stripe-minted; no admin markPaid
 *    action exists and a manual mark would desync Stripe (FLAGGED).
 * Each button submits setBookingStatus (the shipped action) with a target status.
 */
type DrawerAction = {
  label: string
  target: BookingStatus
  variant: ButtonVariant
  icon: 'check' | 'x' | 'undo'
  /** true → tint the ghost button with the danger token (destructive: Avboka). */
  danger?: boolean
}

function actionsFor(status: string): DrawerAction[] {
  const can = (target: BookingStatus) =>
    (ALLOWED_FROM[target] as readonly string[]).includes(status)
  const out: DrawerAction[] = []
  if (isBokad(status)) {
    // "Avboka" is destructive: the Button primitive has no 'danger' variant, so
    // we use ghost + a danger-token inline tint (no new shared class needed).
    if (can('cancelled')) out.push({ label: 'Avboka', target: 'cancelled', variant: 'ghost', icon: 'x', danger: true })
    if (can('completed')) out.push({ label: 'Markera klar', target: 'completed', variant: 'primary', icon: 'check' })
  } else if (isKlar(status)) {
    // Undo a mis-mark back to confirmed (allowed: completed → confirmed).
    if (can('confirmed')) out.push({ label: 'Öppna igen', target: 'confirmed', variant: 'ghost', icon: 'undo' })
  } else if (status === 'no_show') {
    if (can('confirmed')) out.push({ label: 'Öppna igen', target: 'confirmed', variant: 'ghost', icon: 'undo' })
  }
  return out
}

function BookingDrawer({
  booking,
  tz,
  onClose,
  staffNoun,
}: {
  booking: BookingRow
  tz: string
  onClose: () => void
  staffNoun: string
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setBookingStatus, {})

  useEffect(() => {
    // Key on the whole `state` object: useActionState returns a FRESH reference
    // per dispatch, but setBookingStatus returns an IDENTICAL success string each
    // time — keying on state.success would skip the effect on a 2nd consecutive
    // action (klar → öppna igen), dropping its toast + refresh. The {} mount pass
    // is a no-op via the guards below; router.refresh() doesn't mutate state.
    if (state.success) {
      notify('Status uppdaterad — speglas på storefront, personal och översikt', 'success')
      router.refresh()
    }
    if (state.error) notify(state.error, 'warning')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const actions = actionsFor(booking.status)
  const terminal = isAvbokad(booking.status)
  const showAutoKlar = booking.isPast && isBokad(booking.status)
  // Payment-guard: a not-yet-paid, non-cancelled booking must never be auto-marked
  // "klar + betald" (sen kund / no-show). Honest about the real payment state.
  const showPaymentGuard = booking.paymentStatus !== 'succeeded' && !isAvbokad(booking.status)

  // The single bookings.note → ONE neutral system-channel bubble (no kund/staff
  // channel exists in the schema; authorship is unknown, so never 'kund').
  const notes: ThreadNote[] =
    booking.note && booking.note.trim() !== ''
      ? [{ id: booking.id, from: 'system', text: booking.note, meta: 'Notering mot bokningen' }]
      : []

  return (
    <Drawer
      title={booking.serviceName}
      sub={`${dayLabel(booking.startTs, tz)} ${timeLabel(booking.startTs, tz)}–${timeLabel(booking.endTs, tz)} · ${booking.staffTitle}`}
      accent={<span className={badgeClass(booking.status)}>{statusLabel(booking.status)}</span>}
      onClose={onClose}
      ariaLabel={`Bokning ${booking.serviceName}`}
      footer={
        terminal ? (
          <Callout tone="info" icon="shield">
            Avbokade och uteblivna bokningar är slutgiltiga — de raderas aldrig och kan inte
            återställas (en återbetalning är redan hanterad). Skapa en ny bokning vid behov.
          </Callout>
        ) : actions.length > 0 ? (
          // One <form> per action: the shipped Button primitive doesn't forward a
          // name/value, so each action carries its own hidden bookingId + status.
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            {actions.map((a) => (
              <form key={a.target} action={formAction} style={{ flex: 1, display: 'flex' }}>
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
        {/* auto-klar info + payment guard (mock §4.6) */}
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

        {/* Kund — maskerat visningsnamn (samma privacy-regel som Kunder-sidan) +
            länk till kundkortet. Tidsbunden PII (mejl/telefon) visas ALDRIG här —
            den bor bakom operations-fönstret på kundens egen sida. */}
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
              <Icon name="info" size={16} style={{ color: 'var(--c-ink-3)', flex: 'none', marginTop: 1 }} />
              <span style={{ fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.45 }}>
                Bokningen saknar kopplad kundprofil (gäst- eller äldre bokning) — det finns inget
                kundkort att visa. Nya bokningar via storefronten kopplas automatiskt.
              </span>
            </div>
          )}
        </section>

        {/* service detail (mock "Tjänst & bokning") */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Tjänst & bokning
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <DetailPair
              label="Tid"
              value={`${dayLabel(booking.startTs, tz)} ${timeLabel(booking.startTs, tz)}–${timeLabel(booking.endTs, tz)}`}
              num
            />
            <DetailPair label={staffNoun} value={booking.staffTitle} />
            <DetailPair label="Pris" value={priceLabel(booking.priceCents)} num />
            <DetailPair label="Betalning" value={paymentLabel(booking)} num />
            <DetailPair
              label="Bokad den"
              value={`${dayLabel(booking.createdAt, tz)} ${timeLabel(booking.createdAt, tz)}`}
              num
            />
            <DetailPair label="Status" value={statusLabel(booking.status)} />
          </div>
        </section>

        {/* noteringar mot bokningen (single bookings.note — read-only, no write action) */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Noteringar mot bokningen
          </div>
          <NotesThread
            notes={notes}
            emptyText="Ingen notering på den här bokningen. Kundens meddelande vid bokning landar här."
          />
        </section>

        {state.error && (
          <p className="auth-error" role="alert">
            {state.error}
          </p>
        )}
      </div>
    </Drawer>
  )
}
