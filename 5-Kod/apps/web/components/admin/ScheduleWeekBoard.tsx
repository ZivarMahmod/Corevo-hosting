'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition, type ReactNode } from 'react'
import { Icon } from '@/components/portal/ui'

/**
 * Vecko-översikt för HELA teamet — schemat är frisörens viktigaste yta, så läget
 * (vem jobbar när, frånvaro, bokningstryck) ska synas på EN skärm innan man rör
 * mallarna. Rader = aktiv personal, kolumner = Mån–Sön med riktiga datum.
 *
 * Navigering är LÄNKAR (?week=YYYY-MM-DD), inte klient-state: veckan blir delbar/
 * bokmärkbar och servern räknar alla UTC-fönster i tenantens tz — komponenten
 * ritar bara det page.tsx redan härlett (inga egna Date-beräkningar här).
 */

export type BoardDay = {
  /** YYYY-MM-DD — kolumnens kalenderdag. */
  date: string
  /** Kort dagnamn ("Mån"). */
  name: string
  dayOfMonth: number
  isToday: boolean
}

export type BoardInterval = {
  /** "09–18" / "09:30–17:30" — mall-intervallet formatterat server-side. */
  label: string
  /** Platsnamn att visa som badge (endast multi-plats; null = ingen badge). */
  tag: string | null
  /** True när intervallet ligger på en ANNAN plats än den valda → dämpas. */
  offSite: boolean
}

export type BoardCell = {
  intervals: BoardInterval[]
  /** Frånvaro-overlay när en time_off-rad överlappar dagen. */
  timeOff: { reason: string | null } | null
  /** Antal bokningar (pending/confirmed) den dagen. */
  bookings: number
}

export type BoardRow = {
  staffId: string
  name: string
  /** True för raden vars mall-redigerare är öppen nedanför (#mallar). */
  isSelected: boolean
  /** Exakt 7 celler, Mån→Sön. */
  cells: BoardCell[]
}

export type BoardLocation = { id: string; name: string }

export function ScheduleWeekBoard({
  weekLabel,
  isCurrentWeek,
  days,
  rows,
  prevWeek,
  nextWeek,
  todayWeek,
  selectedStaffId,
  plats,
  locations,
  staffNoun,
  basePath = '/admin/scheman',
  readOnly = false,
}: {
  weekLabel: string
  isCurrentWeek: boolean
  days: BoardDay[]
  rows: BoardRow[]
  prevWeek: string
  nextWeek: string
  todayWeek: string
  selectedStaffId: string
  /** Vald plats-filter ('' = alla). Skickas bara meningsfullt vid >1 aktiv plats. */
  plats: string
  /** >1 aktiv plats → själva filtret; annars tom lista → ingen plats-UI alls. */
  locations: BoardLocation[]
  staffNoun: string
  /** Rutt bläddringen länkar inom — kiosken (Schemavy) skickar sin egen. */
  basePath?: string
  /** Kiosk-läget: personalraderna är inte länkar till mall-redigeraren. */
  readOnly?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  // Alla länkar bevarar staff + plats så vecko-bläddring aldrig tappar kontext.
  const href = (params: { week?: string; staff?: string; plats?: string }, hash = '') => {
    const q = new URLSearchParams()
    q.set('week', params.week ?? todayWeek)
    const s = params.staff ?? selectedStaffId
    if (s) q.set('staff', s)
    const p = params.plats ?? plats
    if (p) q.set('plats', p)
    return `${basePath}?${q.toString()}${hash}`
  }

  return (
    <div style={{ opacity: pending ? 0.6 : 1, transition: 'opacity var(--dur-fast, 0.12s)' }}>
      {/* ── Nav-rad: ← Föregående · Idag · Nästa → + vecko-etikett + plats-filter ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <WeekNavLink href={href({ week: prevWeek })} ariaLabel="Föregående vecka">
            <Icon name="chevronLeft" size={15} /> Föregående
          </WeekNavLink>
          <WeekNavLink href={href({ week: todayWeek })} ariaLabel="Hoppa till innevarande vecka" emphasized={!isCurrentWeek}>
            Idag
          </WeekNavLink>
          <WeekNavLink href={href({ week: nextWeek })} ariaLabel="Nästa vecka">
            Nästa <Icon name="chevronRight" size={15} />
          </WeekNavLink>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 19,
            fontWeight: 700,
            color: 'var(--c-forest)',
            marginLeft: 4,
          }}
        >
          {weekLabel}
        </div>

        {locations.length > 1 && (
          <label
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              color: 'var(--c-ink-3)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <Icon name="mapPin" size={14} />
            Plats
            <select
              value={plats}
              onChange={(e) => start(() => router.push(href({ plats: e.target.value })))}
              style={{
                font: 'inherit',
                fontSize: 13,
                padding: '6px 9px',
                borderRadius: 8,
                border: '1px solid var(--c-line)',
                background: 'var(--c-paper)',
                color: 'var(--c-ink)',
              }}
            >
              <option value="">Alla platser</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* ── Rutnätet: rad = medarbetare, kolumn = dag. Horisontell scroll på små
             skärmar (7 dagar går inte att stacka utan att veckoläget tappas). ── */}
      <div
        style={{
          background: 'var(--c-paper)',
          border: '1px solid var(--c-line)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-sm)',
          overflowX: 'auto',
        }}
      >
        {rows.length === 0 ? (
          <p className="small" style={{ margin: 0, padding: '18px 20px', color: 'var(--c-ink-3)' }}>
            Ingen aktiv personal att visa. Aktivera minst en medarbetare under <em>Personal</em> så
            fylls veckoöversikten här.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(150px, 190px) repeat(7, minmax(104px, 1fr))',
              minWidth: 930,
            }}
          >
            {/* Rubrikrad */}
            <div style={{ ...headCellStyle, textAlign: 'left', paddingLeft: 16 }}>{staffNoun}</div>
            {days.map((d) => (
              <div
                key={d.date}
                style={{
                  ...headCellStyle,
                  background: d.isToday ? 'var(--c-gold-100)' : 'transparent',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--c-ink-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                  }}
                >
                  {d.name}
                  {d.isToday && (
                    <span style={{ marginLeft: 5, color: 'var(--c-gold-600)', fontWeight: 700 }}>
                      Idag
                    </span>
                  )}
                </div>
                <div
                  className="num"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--c-forest)',
                    lineHeight: 1.15,
                  }}
                >
                  {d.dayOfMonth}
                </div>
              </div>
            ))}

            {/* Personalrader */}
            {rows.map((row) => (
              <StaffBoardRow
                key={row.staffId}
                row={row}
                days={days}
                href={readOnly ? null : href({ staff: row.staffId }, '#mallar')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const headCellStyle = {
  padding: '10px 10px 9px',
  borderBottom: '1px solid var(--c-line)',
  textAlign: 'center' as const,
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--c-ink-3)',
}

function WeekNavLink({
  href,
  children,
  ariaLabel,
  emphasized = false,
}: {
  href: string
  children: ReactNode
  ariaLabel: string
  emphasized?: boolean
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '7px 12px',
        borderRadius: 999,
        border: `1px solid ${emphasized ? 'var(--c-forest)' : 'var(--c-line)'}`,
        background: 'var(--c-paper)',
        color: emphasized ? 'var(--c-forest)' : 'var(--c-ink-2)',
        textDecoration: 'none',
        fontFamily: 'var(--font-ui)',
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      {children}
    </Link>
  )
}

// En rad = klickbar medarbetare (öppnar/scrollar till mall-redigeraren nedanför)
// + 7 dagsceller. Vald rad markeras med forest-kant så kopplingen rad ↔ mall syns.
// href=null (kiosk/Schemavy) → namncellen är ren text, ingen mall-koppling.
function StaffBoardRow({ row, days, href }: { row: BoardRow; days: BoardDay[]; href: string | null }) {
  const initial = row.name.trim().charAt(0).toUpperCase() || '?'
  const nameCellStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '12px 10px 12px 16px',
    borderBottom: '1px solid var(--c-line)',
    borderLeft: row.isSelected ? '3px solid var(--c-forest)' : '3px solid transparent',
    textDecoration: 'none',
    background: row.isSelected ? 'var(--c-paper-2)' : 'transparent',
  } as const
  const nameCellInner = (
    <>
      <span
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          background: 'var(--c-forest)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          fontWeight: 700,
          flex: 'none',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {initial}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--c-ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {row.name}
      </span>
    </>
  )
  return (
    <>
      {href ? (
        <Link href={href} title={`Öppna veckoschemat (mall) för ${row.name}`} style={nameCellStyle}>
          {nameCellInner}
        </Link>
      ) : (
        <div style={nameCellStyle}>{nameCellInner}</div>
      )}

      {row.cells.map((cell, i) => {
        const day = days[i]!
        const free = cell.intervals.length === 0 && !cell.timeOff
        return (
          <div
            key={`${row.staffId}-${day.date}`}
            style={{
              padding: '10px 8px',
              borderBottom: '1px solid var(--c-line)',
              borderLeft: '1px solid var(--c-line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              // Ledig dag = dämpad cell; frånvarodag behåller paper så overlayn bär tonen.
              background: free ? 'var(--c-paper-2)' : 'transparent',
              minHeight: 58,
            }}
          >
            {cell.timeOff ? (
              <div
                style={{
                  borderRadius: 8,
                  background: 'var(--c-gold-100)',
                  padding: '6px 8px',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--c-gold-600)' }}>
                  Frånvaro
                </div>
                {cell.timeOff.reason && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--c-ink-2)',
                      marginTop: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={cell.timeOff.reason}
                  >
                    {cell.timeOff.reason}
                  </div>
                )}
              </div>
            ) : free ? (
              <span
                style={{
                  fontSize: 11.5,
                  color: 'var(--c-ink-3)',
                  fontFamily: 'var(--font-ui)',
                  padding: '4px 2px',
                }}
              >
                Ledig
              </span>
            ) : (
              cell.intervals.map((iv, j) => (
                <div
                  key={j}
                  style={{
                    borderRadius: 7,
                    background: iv.offSite ? 'transparent' : 'var(--c-success-bg)',
                    border: iv.offSite ? '1px dashed var(--c-line-strong)' : 'none',
                    padding: '4px 7px',
                    opacity: iv.offSite ? 0.75 : 1,
                  }}
                >
                  <span
                    className="num"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: iv.offSite ? 'var(--c-ink-3)' : 'var(--c-success)',
                    }}
                  >
                    {iv.label}
                  </span>
                  {iv.tag && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 10,
                        color: 'var(--c-ink-3)',
                        fontFamily: 'var(--font-ui)',
                        marginTop: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={iv.tag}
                    >
                      <Icon name="mapPin" size={9} style={{ verticalAlign: '-1px' }} /> {iv.tag}
                    </span>
                  )}
                </div>
              ))
            )}

            {cell.bookings > 0 && (
              <span
                className="num"
                style={{
                  fontSize: 11,
                  color: 'var(--c-ink-3)',
                  fontFamily: 'var(--font-ui)',
                  marginTop: 'auto',
                }}
              >
                {cell.bookings} {cell.bookings === 1 ? 'bokning' : 'bokningar'}
              </span>
            )}
          </div>
        )
      })}
    </>
  )
}
