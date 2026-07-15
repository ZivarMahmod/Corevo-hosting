import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { dashboardData, staffDay, type AdminBooking } from '@/lib/admin/data'
import { getAdminModuleStates, isBookingActivated } from '@/lib/admin/modules'
import { todayInTz, dayRangeUtc, weekRangeUtc } from '@/lib/admin/dates'
import { formatPrice, formatTime } from '@/lib/admin/format'
import {
  greetingFor,
  parseHM,
  hourInTz,
  laneBlock,
  occupancyPct,
  comparisonPct,
  countdownMinutes,
} from '@/lib/admin/dashboard-view'
import { Button, Callout } from '@/components/portal/ui'
import { CancellationStats } from '@/components/admin/CancellationStats'
import styles from './dashboard.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Översikt · Adminpanel' }

/** Översikten är ENTRÉN, inte arbetsbordet (låst beslut, codex/00 §2): den svarar på
 *  "vad händer nu", "läget i siffror" och "vad kräver mitt beslut" — och pekar vidare
 *  till Kalendern. goal-68 (Claude Design v2 + Zivars omgång): tvåkolumnslayout —
 *  vänster = operativt (Härnäst-hero, tidslinje, kommande), höger = läget (siffror,
 *  inkorg, genvägar). Tidslinjen är LÄS-BARA: inga block att dra, ingen andra kalender.
 *  Alla tal kommer ur riktig data; inget fejkas. */
export default async function AdminPage() {
  const user = await requireAdminArea('oversikt')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Översikt</h1>
        <p className="prose">Inget företag är kopplat till ditt konto. Kontakta Corevo.</p>
      </section>
    )
  }

  const tz = tenant.timeZone
  const today = todayInTz(tz)
  const dayRange = dayRangeUtc(today, tz)
  // Samma veckodag förra veckan (för +% jämförelsen).
  const prevDate = new Date(`${today}T12:00:00Z`)
  prevDate.setUTCDate(prevDate.getUTCDate() - 7)
  const prevRange = dayRangeUtc(prevDate.toISOString().slice(0, 10), tz)
  // Avbokningspanelens fönster: veckans start (måndag) + månadens första dag i tenant-tz.
  const weekStart = weekRangeUtc(today, tz).fromUtc
  const monthStart = dayRangeUtc(`${today.slice(0, 7)}-01`, tz).fromUtc
  // Veckodagen i tenantens tidszon (0=sön … 6=lör).
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()

  const [data, roster, moduleStates] = await Promise.all([
    dashboardData(tenant.id, dayRange, prevRange, {
      weekFromUtc: weekStart,
      monthFromUtc: monthStart,
    }),
    staffDay(tenant.id, weekday),
    getAdminModuleStates(tenant.id),
  ])

  // ── Härledda dagsvärden ────────────────────────────────────────────────────
  const done = data.upcomingToday.filter((b) => b.status === 'completed')
  const active = data.upcomingToday.filter(
    (b) => b.status === 'pending' || b.status === 'confirmed',
  )
  const nowIso = new Date().toISOString()
  const nowMs = Date.parse(nowIso)
  // Framåtblick: allt som inte redan börjat (det som "pågår" är inte KOMMANDE).
  const future = active
    .filter((b) => Date.parse(b.startTs) > nowMs)
    .sort((a, b) => a.startTs.localeCompare(b.startTs))
  const next = future[0] ?? null
  const later = future.slice(1)
  const countdownMin = next ? countdownMinutes(nowMs, Date.parse(next.startTs)) : 0
  // Designkrav: countdown < 10 min = brådskande (warn-gult).
  const countdownUrgent = next != null && countdownMin < 10

  // Kräver uppmärksamhet: obekräftade tider VISAS bara om salongen kräver godkännande
  // (settings.require_booking_approval). En salong godkänner inte varje besök — då är
  // inkorgen till för verkliga undantag: dagens avbokningar (frigjorda luckor).
  const requiresApproval = tenant.requireBookingApproval === true
  const pendingApproval = requiresApproval
    ? active.filter((b) => b.status === 'pending')
    : []
  const attentionCount = pendingApproval.length + data.cancellationsToday.length

  const bookingPaused = !isBookingActivated(moduleStates)

  // ── Siffror ────────────────────────────────────────────────────────────────
  const workingStaff = roster.filter((s) => s.start)
  const donePct = data.todayCount > 0 ? Math.round((done.length / data.todayCount) * 100) : 0
  // Beläggning = bokade minuter / personalens FAKTISKA arbetsminuter (summa av pass,
  // inte ytterspann — staffDay.workedMinutes). Ärligt tak 100%.
  const bookedMin = data.upcomingToday.reduce(
    (sum, b) => sum + Math.max(0, (Date.parse(b.endTs) - Date.parse(b.startTs)) / 60000),
    0,
  )
  const availableMin = workingStaff.reduce((sum, s) => sum + s.workedMinutes, 0)
  const occupancy = occupancyPct(bookedMin, availableMin)
  // +X% mot samma veckodag förra veckan — null döljer chipet (ingen falsk 0%).
  const cmp = comparisonPct(data.todayBookedCents, data.prevWeekdayBookedCents)
  const weekdayName = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', timeZone: tz }).format(
    new Date(),
  )

  // ── Tidslinje: fönster + block per resurs ──────────────────────────────────
  const startsH = workingStaff.map((s) => parseHM(s.start!))
  const endsH = workingStaff.map((s) => parseHM(s.end!))
  const dayStartH = startsH.length ? Math.floor(Math.min(...startsH)) : 9
  const dayEndH = endsH.length ? Math.ceil(Math.max(...endsH)) : 18
  const span = Math.max(1, dayEndH - dayStartH)
  const pos = (h: number) => ((h - dayStartH) / span) * 100
  const axisHours = Array.from({ length: dayEndH - dayStartH + 1 }, (_, i) => dayStartH + i)
  const nowH = hourInTz(nowIso, tz)
  const showNow = nowH >= dayStartH && nowH <= dayEndH
  const bookingsByStaff = new Map<string, AdminBooking[]>()
  for (const b of data.upcomingToday) {
    const arr = bookingsByStaff.get(b.staffId) ?? []
    arr.push(b)
    bookingsByStaff.set(b.staffId, arr)
  }

  // ── Presentation-hjälp ─────────────────────────────────────────────────────
  const greeting = greetingFor(nowH)
  const firstName = user.name?.split(/\s+/)[0] ?? null
  const dateLabel = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  }).format(new Date())
  const nameOf = (b: AdminBooking) => b.customerName ?? 'Gäst'
  const timeOf = (b: AdminBooking) => formatTime(b.startTs, tz)
  const durationOf = (b: AdminBooking) =>
    Math.max(0, Math.round((Date.parse(b.endTs) - Date.parse(b.startTs)) / 60000))
  const staffColorOf = (id: string) => roster.find((s) => s.staffId === id)?.color ?? 'var(--c-ink-3)'

  return (
    <div className={styles.page}>
      {/* ── Sidhuvud ── */}
      <div className={styles.head}>
        <div>
          <div className={`num ${styles.eyebrow}`}>
            {dateLabel} · Alla platser
          </div>
          <h1 className={styles.greeting}>
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <div className={styles.headSub}>
            {data.todayCount} bokningar idag · {done.length} klara
            {next ? (
              <>
                {' '}· nästa besök om{' '}
                <strong style={countdownUrgent ? { color: 'var(--c-warning)' } : undefined}>
                  {countdownMin} min
                </strong>
              </>
            ) : (
              ' · inget kvar idag'
            )}
          </div>
        </div>
        <div className={styles.headActions}>
          <Button href="/admin/bokningar?ny=1" variant="subtle">
            + Ny bokning
          </Button>
          <Button href="/admin/bokningar" variant="primary" icon="calendar">
            Öppna kalendern
          </Button>
        </div>
      </div>

      {bookingPaused && (
        <Callout tone="warning" icon="alert">
          <strong>Publik bokning är pausad.</strong> Kunder kan inte boka på din sida just nu.
          Bokningar du själv lägger in i kalendern fungerar som vanligt.
        </Callout>
      )}

      <div className={styles.grid}>
        {/* ── VÄNSTER: operativt ── */}
        <div className={styles.col}>
          {/* Härnäst-hero */}
          <div className={styles.hero}>
            <div className={styles.heroMain}>
              <div className={styles.heroTop}>
                <span className={`num ${styles.kicker}`}>HÄRNÄST</span>
                {next && (
                  <span
                    className={`num ${styles.heroCountdown}`}
                    style={countdownUrgent ? { color: 'var(--c-warning)' } : undefined}
                  >
                    om {countdownMin} min
                  </span>
                )}
              </div>
              {next ? (
                <>
                  <div className={styles.heroHeadline}>
                    <span className={`num ${styles.heroClock}`}>{timeOf(next)}</span>
                    <span className={styles.heroService}>{next.serviceName}</span>
                  </div>
                  <div className={styles.heroMeta}>
                    <span className={styles.heroCustomer}>{nameOf(next)}</span>
                    <span>·</span>
                    <span className={styles.heroStaff}>
                      <span
                        className={styles.dot}
                        style={{ background: staffColorOf(next.staffId) }}
                      />
                      hos {next.staffTitle}
                    </span>
                    <span>·</span>
                    <span>{durationOf(next)} min</span>
                    {next.priceCents != null && (
                      <>
                        <span>·</span>
                        <span>{formatPrice(next.priceCents)}</span>
                      </>
                    )}
                  </div>
                  <div className={styles.heroActions}>
                    <Button href={`/admin/bokningar?open=${next.id}`} variant="primary" size="sm">
                      Öppna bokning
                    </Button>
                    {next.customerId && (
                      <Button href={`/admin/kunder/${next.customerId}`} variant="subtle" size="sm">
                        Visa kund
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.heroEmpty}>
                  <strong>Inga fler tider idag.</strong>
                  {data.todayCount === 0
                    ? 'Nya bokningar dyker upp här automatiskt.'
                    : `Alla dagens ${data.todayCount} tider är avklarade.`}
                  <div className={styles.heroActions}>
                    <Button href="/admin/bokningar?ny=1" variant="primary" size="sm">
                      + Ny bokning
                    </Button>
                    <Button href="/admin/bokningar?blockera=1" variant="subtle" size="sm">
                      Blockera tid
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.heroSide}>
              <span className={`num ${styles.kicker}`}>DÄREFTER</span>
              {later.length === 0 ? (
                <div className={styles.heroSideEmpty}>Inget mer i kön.</div>
              ) : (
                <div className={styles.heroSideList}>
                  {later.slice(0, 3).map((b) => (
                    <Link key={b.id} href={`/admin/bokningar?open=${b.id}`} className={styles.laterRow}>
                      <span className={`num ${styles.laterTime}`}>{timeOf(b)}</span>
                      <span className={styles.laterName}>
                        {b.serviceName} · {nameOf(b)}
                      </span>
                      <span className={styles.dot} style={{ background: staffColorOf(b.staffId) }} />
                    </Link>
                  ))}
                </div>
              )}
              {later.length > 0 && (
                <Link href="/admin/bokningar" className={styles.laterAll}>
                  Alla {later.length} kvarvarande →
                </Link>
              )}
            </div>
          </div>

          {/* Dagens schema — tidslinje (läs-bara) */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Dagens schema</h2>
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <span className={styles.legendBooked} /> Bokad
                </span>
                <span className={styles.legendItem}>
                  <span className={styles.legendDone} /> Klar
                </span>
                <span className={styles.legendItem}>
                  <span className={styles.legendNow} /> Nu
                </span>
              </div>
            </div>

            {roster.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>Ingen personal upplagd.</strong>
                Lägg till medarbetare under Inställningar.
              </div>
            ) : (
              <div className={styles.timeline}>
                {/* timaxel */}
                <div className={styles.axisRow}>
                  <div />
                  <div className={styles.axis}>
                    {axisHours.map((h) => (
                      <span
                        key={h}
                        className={`num ${styles.axisTick}`}
                        style={{ left: `${pos(h)}%` }}
                      >
                        {String(h).padStart(2, '0')}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.lanes}>
                  {showNow && (
                    <div
                      className={styles.nowLine}
                      style={{ left: `calc(150px + 16px + (100% - 166px) * ${pos(nowH) / 100})` }}
                    />
                  )}
                  {roster.map((s) => {
                    const blocks = bookingsByStaff.get(s.staffId) ?? []
                    return (
                      <div key={s.staffId} className={styles.lane}>
                        <div className={styles.laneHead}>
                          <span className={styles.dot} style={{ background: s.color }} />
                          <div style={{ minWidth: 0 }}>
                            <div className={styles.laneName}>{s.name}</div>
                            <div className={`num ${styles.lanePass}`}>
                              {s.start ? `${s.start.slice(0, 5)}–${s.end!.slice(0, 5)}` : 'Ledig idag'}
                            </div>
                          </div>
                        </div>
                        <div className={styles.track}>
                          {!s.start && <span className={styles.laneFree}>Ledig — inga pass</span>}
                          {blocks.map((b) => {
                            const g = laneBlock(
                              hourInTz(b.startTs, tz),
                              hourInTz(b.endTs, tz),
                              dayStartH,
                              dayEndH,
                            )
                            // Helt utanför dagsfönstret → rita inget (klampat till bredd 0).
                            if (g.width <= 0) return null
                            const isDone = b.status === 'completed'
                            const isHot = next?.id === b.id
                            return (
                              <span
                                key={b.id}
                                title={`${timeOf(b)} ${b.serviceName}`}
                                className={`${styles.block} ${isDone ? styles.blockDone : ''} ${
                                  isHot ? styles.blockHot : ''
                                }`}
                                style={{
                                  left: `${g.left}%`,
                                  width: `${Math.max(2, g.width)}%`,
                                  borderLeftColor: s.color,
                                }}
                              >
                                <span className={`num ${styles.blockLabel}`}>{b.serviceName}</span>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Kommande idag */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Kommande idag</h2>
              <Link href="/admin/bokningar" className={styles.cardLink}>
                Visa i kalendern →
              </Link>
            </div>
            {future.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>Inga fler tider kvar idag.</strong>
                Nya bokningar dyker upp här automatiskt.
              </div>
            ) : (
              <div className={styles.upcoming}>
                {future.slice(0, 6).map((b) => {
                  const st = STATUS_META[b.status] ?? { label: 'Bokad', color: 'var(--c-ink-3)' }
                  return (
                    <Link key={b.id} href={`/admin/bokningar?open=${b.id}`} className={styles.upRow}>
                      <span className={`num ${styles.upTime}`}>{timeOf(b)}</span>
                      <span className={styles.upName}>{nameOf(b)}</span>
                      <span className={styles.upService}>{b.serviceName}</span>
                      <span className={styles.upStaff}>
                        <span className={styles.dot} style={{ background: staffColorOf(b.staffId) }} />
                        {b.staffTitle}
                      </span>
                      <span className={`num ${styles.upStatus}`} style={{ color: st.color }}>
                        {st.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── HÖGER: läget ── */}
        <div className={styles.col}>
          {/* Idag i siffror */}
          <div className={styles.card}>
            <div className={styles.statsPad}>
              <div className={`num ${styles.kicker}`} style={{ marginBottom: 4 }}>
                IDAG I SIFFROR
              </div>
              <div className={styles.statRow}>
                <div>
                  <div className={styles.statBig}>{data.todayCount}</div>
                  <div className={styles.statSub}>
                    bokningar · {done.length} klara · {active.length} kvar
                  </div>
                </div>
                <div className={styles.bar}>
                  <div className={styles.barFill} style={{ width: `${donePct}%`, background: 'var(--c-success)' }} />
                </div>
              </div>
              <div className={styles.statRow}>
                <div>
                  <div className={styles.statBig}>{formatPrice(data.todayBookedCents)}</div>
                  <div className={styles.statSub}>
                    bokat idag · {formatPrice(data.todayDoneCents)} klart
                    {data.todayUnpriced > 0 ? ` · ${data.todayUnpriced} utan pris` : ''}
                  </div>
                </div>
                {cmp != null && (
                  <div
                    className={`num ${styles.cmp}`}
                    style={{ color: cmp >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}
                  >
                    {cmp >= 0 ? '+' : ''}
                    {cmp}% v. {weekdayName}
                  </div>
                )}
              </div>
              <div className={styles.statRow} style={{ borderBottom: 'none', paddingBottom: 2 }}>
                <div>
                  <div className={styles.statBig}>{occupancy}%</div>
                  <div className={styles.statSub}>
                    beläggning · {workingStaff.length} i tjänst
                  </div>
                </div>
                <div className={styles.bar}>
                  <div className={styles.barFill} style={{ width: `${occupancy}%`, background: 'var(--c-info)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Kräver uppmärksamhet */}
          <div className={styles.card}>
            <div className={styles.attnPad}>
              <div className={styles.attnHead}>
                <h2 className={styles.cardTitle}>Kräver uppmärksamhet</h2>
                {attentionCount > 0 && (
                  <span className={`num ${styles.attnBadge}`}>{attentionCount}</span>
                )}
              </div>

              {attentionCount === 0 ? (
                <div className={styles.attnEmpty}>Inget kräver din uppmärksamhet just nu.</div>
              ) : (
                <>
                  {pendingApproval.map((b) => (
                    <div key={b.id} className={styles.attnItem}>
                      <span className={styles.attnDot} style={{ background: 'var(--c-warning)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={styles.attnTitle}>Obekräftad bokning</div>
                        <div className={styles.attnDetail}>
                          {nameOf(b)} · {timeOf(b)} · {b.serviceName}
                        </div>
                        <div className={styles.attnActions}>
                          <Button href={`/admin/bokningar?open=${b.id}`} variant="subtle" size="sm">
                            Öppna
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.cancellationsToday.map((b) => (
                    <div key={b.id} className={styles.attnItem}>
                      <span className={styles.attnDot} style={{ background: 'var(--c-danger)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={styles.attnTitle}>Avbokning — lucka {timeOf(b)}</div>
                        <div className={styles.attnDetail}>
                          {nameOf(b)} avbokade · {durationOf(b)} min hos {b.staffTitle} frigjord
                        </div>
                        <div className={styles.attnActions}>
                          <Button href="/admin/bokningar?ny=1" variant="subtle" size="sm">
                            Fyll luckan
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Avbokningar — period-växlare (antal + förlorat värde) */}
          <CancellationStats
            today={{
              count: data.cancellationStats.today.count,
              value: formatPrice(data.cancellationStats.today.cents),
            }}
            week={{
              count: data.cancellationStats.week.count,
              value: formatPrice(data.cancellationStats.week.cents),
            }}
            month={{
              count: data.cancellationStats.month.count,
              value: formatPrice(data.cancellationStats.month.cents),
            }}
          />

          {/* Genvägar */}
          <div className={styles.card}>
            <div className={styles.statsPad}>
              <div className={`num ${styles.kicker}`} style={{ marginBottom: 14 }}>
                GENVÄGAR
              </div>
              <div className={styles.shortcuts}>
                <Link href="/admin/bokningar?ny=1" className={styles.shortcut}>
                  ＋ Ny bokning
                </Link>
                <Link href="/admin/bokningar?blockera=1" className={styles.shortcut}>
                  ◔ Blockera tid
                </Link>
                <Link href="/admin/kunder" className={styles.shortcut}>
                  ◉ Kunder
                </Link>
                <Link href="/admin/statistik" className={styles.shortcut}>
                  ▤ Statistik
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Statuschip-etikett + färg (page-lokalt, ingen data-access).
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Obekräftad', color: 'var(--c-warning)' },
  confirmed: { label: 'Bekräftad', color: 'var(--c-success)' },
  completed: { label: 'Klar', color: 'var(--c-ink-3)' },
}
