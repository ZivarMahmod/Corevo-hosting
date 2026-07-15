'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { addDays as addDaysStr, isoWeekNumber } from '@/lib/admin/dates'
import { occupancyPct } from '@/lib/admin/dashboard-view'
import { moveBooking } from '@/lib/admin/calendar-actions'
import { Button, Icon, Modal, useToast } from '@/components/portal/ui'
import dynamic from 'next/dynamic'
import {
  BookingDrawer,
  dayKey,
  isAvbokad,
  isKlar,
  statusAccent,
  telHref,
  timeLabel,
  type BookingRow,
} from './BookingDrawer'
import type { CalendarService, NewBookingSeed } from './NewBookingDrawer'

// Prestanda B4: dynamic() splittar dessa fyra ur kalenderns HUVUD-chunk (~40-50 kB).
// NewBookingDrawer + BlockDrawer renderas villkorligt (creating/blocking-state) → chunken
// hämtas först vid klick. CalendarHelp + CancelledLog monteras alltid (deras trigger-knapp
// syns i verktygsraden; bara modal-innehållet är klick-gatat) → deras chunk hämtas vid
// mount, men ligger fortfarande UTANFÖR huvud-chunken (mindre initial parse). BookingDrawer
// lämnas STATISK: den delar modul med synkrona render-hjälpare (dayKey/isAvbokad/isKlar/
// statusAccent/timeLabel) som CalendarBoard behöver eagerly — att splitta drar in modulen ändå.
const NewBookingDrawer = dynamic(() => import('./NewBookingDrawer').then((m) => m.NewBookingDrawer))
const BlockDrawer = dynamic(() => import('./BlockDrawer').then((m) => m.BlockDrawer))
const CalendarHelp = dynamic(() => import('./CalendarHelp').then((m) => m.CalendarHelp))
const CancelledLog = dynamic(() => import('./CancelledLog').then((m) => m.CancelledLog))
import { CalendarSearch } from './CalendarSearch'
import { staffColor, staffInitials } from '@/lib/admin/staff-colors'
import styles from './calendar.module.css'

/** Kalenderarbetsbordet (goal-66). ETT arbetsbord, tre vyer — inte tre sidor:
 *
 *   Dag    — tidsgeometrisk: kolumn per resurs, y = starttid, höjd = längd.
 *            Här sker 95 % av arbetet (Wavys kärna).
 *   Vecka  — 7 dagar, samma tidsgeometri, alla resurser överlagrade.
 *   Månad  — rutnät med dagens belastning. Klick på dag → dagvy.
 *
 *  Ytan fyller allt utrymme under toppnaven och SCROLLAR INTERNT — sidan själv
 *  scrollar aldrig. Därför fungerar den lika bra på mobil stående, iPad liggande och
 *  desktop utan att bli "fast konstig": toppnaven ligger kvar, gridet anpassar sig.
 *
 *  Vy + datum bor i URL:en (?vy=&datum=), inte i local state — en delad länk öppnar
 *  exakt samma arbetsbord, och webbläsarens bakåtknapp fungerar. */

export type CalendarStaff = {
  id: string
  name: string
  /** Arbetstidens ytterkanter den valda dagen ('HH:MM'), null = ledig. */
  start: string | null
  end: string | null
  /** goal-67: personens kalenderfärg (hex). Serverhärledd — aldrig null här. */
  color: string
  /** Arbetsminuter den valda dagen (sammanslagna pass) — nämnaren i beläggningssiffran. */
  workedMinutes: number
}

/** En blockerad tid (time_off): rast, frånvaro eller avvikande arbetstid. EN
 *  mekanism för allt som gör resursen obokningsbar — ingen separat rast- eller
 *  frånvaromodul (Wavys lärdom: en mekanism, fyra behov). */
export type CalendarBlock = {
  id: string
  staffId: string
  startTs: string
  endTs: string
  reason: string
  /** Satt när blockeringen ingår i en återkommande serie — då erbjuder drawern
   *  "endast denna / denna och framåt" i stället för en enkel borttagning. */
  seriesId: string | null
}

export type CalendarView = 'dag' | 'vecka' | 'manad'

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'dag', label: 'Dag' },
  { value: 'vecka', label: 'Vecka' },
  { value: 'manad', label: 'Månad' },
]

/** Rutnätets upplösning. 15 min är snappningen (Wavy gör samma): ett klick på
 *  09:20-höjd ger 09:15, aldrig 09:20. */
const SNAP_MIN = 15

/** Vilken bokning som dras just nu.
 *
 *  Varför en modulvariabel och inte state: webbläsaren tillåter INTE att man läser
 *  dataTransfer under `dragover` (bara vid drop) — men förhandsvisningen måste veta
 *  hur lång bokningen är för att kunna rita var den slutar. Ett drag åt gången, så en
 *  enkel variabel räcker; state hade orsakat en omrendering per musrörelse. */
let draggingId: string | null = null
/** Pixlar per minut. Styr höjden på en bokning: 60 min = 84 px. Räcker för att läsa
 *  kund + tjänst i ett 30-minuterspass utan att dagen blir orimligt lång. */
const PX_PER_MIN = 1.4

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h! * 60 + m!
}
const fromMin = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Tidsaxeln — samma i dag- och veckovyn, så den bor på ett ställe. */
function TimeAxis({ hours, dayStart }: { hours: number[]; dayStart: number }) {
  return (
    <div className={styles.axis}>
      {hours.map((h) => (
        <div
          key={h}
          className={`num ${styles.axisMark}`}
          style={{ top: (h - dayStart) * PX_PER_MIN }}
        >
          {fromMin(h)}
        </div>
      ))}
    </div>
  )
}

/** Timstrecken i en kolumn. `--half` placerar halvtimmesledtråden rätt oavsett
 *  pixelskala — den får aldrig hårdkodas till ett gissat px-värde. */
function HourLines({ hours, dayStart }: { hours: number[]; dayStart: number }) {
  return (
    <>
      {hours.map((h) => (
        <div
          key={h}
          className={styles.hourLine}
          style={{
            top: (h - dayStart) * PX_PER_MIN,
            ['--half' as string]: `${30 * PX_PER_MIN}px`,
          }}
        />
      ))}
    </>
  )
}

/** Väggklocka (minuter efter midnatt i salongens tidszon) → UTC-instant. Använder
 *  bokningsmotorns egen zonedTimeToUtc — samma konvertering som availability och
 *  bokningsflödet, så en klickad lucka och en beräknad lucka aldrig kan hamna en
 *  timme isär över sommartidsskiftet. */
function wallClockToUtcIso(date: string, minute: number, tz: string): string {
  return zonedTimeToUtc(date, fromMin(minute), tz).toISOString()
}

/** Minuter efter midnatt för ett instant, i salongens tidszon (DST-säkert — vi läser
 *  väggklockan, räknar aldrig på UTC-offset). */
function minutesInTz(ts: string, tz: string): number {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts))
  return toMin(s)
}

/** Bokningar som överlappar i tid inom samma kolumn läggs SIDA VID SIDA, aldrig
 *  ovanpå varandra — en dold bokning är en missad bokning. Girig banindelning:
 *  varje bokning tar första banan där den får plats. */
type Placed = { booking: BookingRow; lane: number; lanes: number }
export function placeOverlaps(items: BookingRow[], tz: string): Placed[] {
  const sorted = [...items].sort(
    (a, b) => minutesInTz(a.startTs, tz) - minutesInTz(b.startTs, tz),
  )
  const laneEnd: number[] = []
  const placed: { booking: BookingRow; lane: number; start: number; end: number }[] = []

  for (const booking of sorted) {
    const start = minutesInTz(booking.startTs, tz)
    const end = minutesInTz(booking.endTs, tz)
    let lane = laneEnd.findIndex((busyUntil) => busyUntil <= start)
    if (lane === -1) {
      lane = laneEnd.length
      laneEnd.push(end)
    } else {
      laneEnd[lane] = end
    }
    placed.push({ booking, lane, start, end })
  }

  // Antal banor räknas per överlappsgrupp, inte för hela dagen: två bokningar kl 9
  // ska inte bli halvbreda bara för att tre andra krockar kl 15.
  return placed.map((p) => {
    const overlapping = placed.filter((q) => q.start < p.end && q.end > p.start)
    const lanes = Math.max(...overlapping.map((q) => q.lane)) + 1
    return { booking: p.booking, lane: p.lane, lanes }
  })
}

export function CalendarBoard({
  bookings,
  blocks,
  staff,
  services,
  tz,
  view,
  date,
  staffNoun,
  locationId,
  /** Dagens datum i salongens tidszon — "Idag"-knappen och nu-linjen utgår från det. */
  today,
  openBookingId,
}: {
  bookings: BookingRow[]
  blocks: CalendarBlock[]
  staff: CalendarStaff[]
  services: CalendarService[]
  tz: string
  view: CalendarView
  date: string
  staffNoun: string
  locationId?: string
  today: string
  openBookingId?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState<BookingRow | null>(
    () => bookings.find((b) => b.id === openBookingId) ?? null,
  )
  /** null = stängd. Ett objekt (ev. med seed) = skapa-läge. Översiktens genväg
   *  "Ny bokning" djuplänkar hit med ?ny → drawern öppnas direkt vid landning. */
  const [creating, setCreating] = useState<{ seed: NewBookingSeed | null } | null>(
    () => (params.get('ny') !== null ? { seed: null } : null),
  )
  /** Blockera tid: ny (seed från gridklick eller tom) eller befintlig (öppnad blockering).
   *  Genvägen "Blockera tid" djuplänkar hit med ?blockera. Ömsesidigt uteslutande med
   *  ?ny — bara en drawer öppnas vid landning. */
  const [blocking, setBlocking] = useState<{
    seed: { staffId: string; startMinute: number } | null
    existing: CalendarBlock | null
  } | null>(() =>
    params.get('blockera') !== null && params.get('ny') === null
      ? { seed: null, existing: null }
      : null,
  )

  // Djuplänk-parametrar (?ny/?blockera) är ENGÅNGS: rensa dem ur URL:en efter att
  // drawern öppnats, annars öppnar en omladdning/tillbaka-navigering den igen.
  useEffect(() => {
    if (params.get('ny') === null && params.get('blockera') === null) return
    const sp = new URLSearchParams(params.toString())
    sp.delete('ny')
    sp.delete('blockera')
    const qs = sp.toString()
    router.replace(qs ? `/admin/bokningar?${qs}` : '/admin/bokningar', { scroll: false })
    // Endast vid mount — parametrarna läses en gång in i drawer-state ovan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { notify } = useToast()
  const [moving, startMove] = useTransition()
  /** Väntande flytt — visas som en bekräftelse med KONSEKVENSEN utskriven, aldrig ett
   *  "Är du säker?". Släpper man fel ska man kunna backa utan att något hänt. */
  const [pendingMove, setPendingMove] = useState<{
    booking: BookingRow
    staffId: string
    startIso: string
  } | null>(null)
  /** Var blocket skulle landa just nu, medan man drar. Ritas som en genomskinlig
   *  förhandsvisning i kolumnen — man ser tiden innan man släpper, i stället för att
   *  släppa och hoppas. Det är skillnaden mellan att dra och att gissa. */
  const [dragOver, setDragOver] = useState<{
    staffId: string
    minute: number
    durationMin: number
  } | null>(null)
  /** Klick-bubblan (designens signatur): ett pekar-/touch-klick på ett block öppnar en
   *  liten bubbla vid pekaren med Ring + Öppna, i stället för att slänga upp hela drawern.
   *  Bara pekare/touch — tangentbord (Enter/Space) öppnar drawern direkt (se BookingBlock),
   *  för en bubbla man inte kan sikta med musen på är bara ett extra steg. */
  const [bubble, setBubble] = useState<{ booking: BookingRow; x: number; y: number } | null>(null)
  const openBubble = (b: BookingRow, x: number, y: number) => setBubble({ booking: b, x, y })

  const staffNames = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff])

  const confirmMove = () => {
    if (!pendingMove) return
    const { booking, staffId, startIso } = pendingMove
    startMove(async () => {
      const res = await moveBooking({ bookingId: booking.id, staffId, startIso })
      if (res.error) notify(res.error, 'warning')
      else {
        notify(res.success ?? 'Bokningen är flyttad.', 'success')
        router.refresh()
      }
      setPendingMove(null)
    })
  }

  // Navigering bor i URL:en. Vy, datum och resursfilter är delbara och bakåtknappen
  // fungerar. resurs: '' = alla (parametern tas bort).
  const go = (next: { vy?: CalendarView; datum?: string; resurs?: string }) => {
    const q = new URLSearchParams(params.toString())
    if (next.vy) q.set('vy', next.vy)
    if (next.datum) q.set('datum', next.datum)
    if (next.resurs !== undefined) {
      if (next.resurs) q.set('resurs', next.resurs)
      else q.delete('resurs')
    }
    q.delete('open')
    router.push(`/admin/bokningar?${q.toString()}`)
  }

  // Resursfilter (B-06): fokusera EN person. Filtreringen sker här — samma data,
  // smalare blick — så filtret följer med gratis mellan dag/vecka/månad. Ett påhittat
  // ?resurs= som inte finns i rostern ignoreras tyst (= alla).
  const resurs = params.get('resurs') ?? ''
  const resursValid = staff.some((s) => s.id === resurs)
  const vStaff = resursValid ? staff.filter((s) => s.id === resurs) : staff
  const vBookings = resursValid ? bookings.filter((b) => b.staffId === resurs) : bookings
  const vBlocks = resursValid ? blocks.filter((b) => b.staffId === resurs) : blocks

  // goal-67 — färgen slås upp på staffId. Vecko- och månadsvyn saknar resurskolumner
  // och är just därför de vyer som BEHÖVER färgen mest. En bokning vars resurs
  // avaktiverats sedan dess (inte i `staff`) faller tillbaka på den härledda färgen —
  // aldrig ett tomt kort.
  const colorOf = useMemo(() => {
    const map = new Map(staff.map((s) => [s.id, s.color]))
    return (staffId: string) => map.get(staffId) ?? staffColor(staffId)
  }, [staff])

  // Verktygsradens mono-statusrad (designens "v.29 · 12 bokningar · 62% · 1 avbokad").
  // Räknas HÄR, på den filtrerade datan (vStaff/vBookings) — så raden följer resurs-
  // och platsfiltret i stället för att visa dagens totaler oavsett vad man tittar på.
  // Bara dagvyn: beläggning över en vecka/månad är en meningslös medelsiffra.
  const dayStats = useMemo(() => {
    if (view !== 'dag') return null
    const cancelled = vBookings.filter((b) => b.status === 'cancelled').length
    const live = vBookings.filter((b) => !isAvbokad(b.status))
    const bookedMin = live.reduce(
      (sum, b) =>
        sum + (new Date(b.endTs).getTime() - new Date(b.startTs).getTime()) / 60000,
      0,
    )
    const workedMin = vStaff.reduce((sum, s) => sum + s.workedMinutes, 0)
    // Beläggning döljs när ett platsfilter är aktivt: arbetsminuterna (workedMinutes) är
    // hela personens arbetsdag, inte platsavgränsade, medan bokningarna ovan ÄR filtrerade
    // per plats → nämnaren skulle bli för stor och siffran ljuga för lågt. Hellre ingen
    // siffra än en felaktig. (Codex-granskning, MEDEL.)
    const occupancy = locationId ? null : occupancyPct(bookedMin, workedMin)
    return {
      week: isoWeekNumber(date),
      count: live.length,
      occupancy,
      cancelled,
    }
  }, [view, vBookings, vStaff, date, locationId])

  // Arbetsdagens fönster = union av resursernas arbetstider. Tom dag (ingen arbetar)
  // faller tillbaka på 08–18 så rutnätet aldrig kollapsar till en tom remsa.
  const [dayStart, dayEnd] = useMemo(() => {
    const starts = vStaff.filter((s) => s.start).map((s) => toMin(s.start!))
    const ends = vStaff.filter((s) => s.end).map((s) => toMin(s.end!))
    // Bokningar utanför arbetstid (t.ex. inlagda före ett schemabyte) måste ändå SYNAS.
    for (const b of vBookings) {
      starts.push(minutesInTz(b.startTs, tz))
      ends.push(minutesInTz(b.endTs, tz))
    }
    if (starts.length === 0) return [8 * 60, 18 * 60]
    const lo = Math.floor(Math.min(...starts) / 60) * 60
    const hi = Math.ceil(Math.max(...ends) / 60) * 60
    return [lo, Math.max(hi, lo + 60)]
  }, [vStaff, vBookings, tz])

  const hours = useMemo(() => {
    const out: number[] = []
    for (let m = dayStart; m <= dayEnd; m += 60) out.push(m)
    return out
  }, [dayStart, dayEnd])

  const gridHeight = (dayEnd - dayStart) * PX_PER_MIN

  const dayLabelLong = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  }).format(new Date(`${date}T12:00:00Z`))

  const monthLabel = new Intl.DateTimeFormat('sv-SE', {
    month: 'long',
    year: 'numeric',
    timeZone: tz,
  }).format(new Date(`${date}T12:00:00Z`))

  const step = view === 'manad' ? 'month' : view === 'vecka' ? 'week' : 'day'
  const shift = (dir: -1 | 1) => {
    const d = new Date(`${date}T12:00:00Z`)
    if (step === 'day') d.setUTCDate(d.getUTCDate() + dir)
    if (step === 'week') d.setUTCDate(d.getUTCDate() + dir * 7)
    if (step === 'month') d.setUTCMonth(d.getUTCMonth() + dir)
    go({ datum: d.toISOString().slice(0, 10) })
  }

  // Klick på ledig yta = "boka här". Tiden SNAPPAS till 15 min (ett klick på 09:20-höjd
  // ger 09:15, aldrig 09:20) och resurs + tid ärvs in i drawern — användaren ska aldrig
  // mata in en kontext hen just pekade på.
  const onEmptyClick = (staffId: string, staffName: string, minute: number) => {
    const snapped = Math.round(minute / SNAP_MIN) * SNAP_MIN
    // Väggklockan (snapped) → UTC-instant för salongens dag. Att räkna på lokal tid och
    // konvertera EN gång är det enda som håller över sommartidsskiftet.
    const startIso = wallClockToUtcIso(date, snapped, tz)
    setCreating({ seed: { staffId, staffName, startIso } })
  }

  /** Släpp av ett draget block. Skriver INTE direkt — en flytt är en handling kunden
   *  märker av, så den bekräftas först, med konsekvensen utskriven. */
  const onDropBooking = (booking: BookingRow, staffId: string, minute: number) => {
    const snapped = Math.round(minute / SNAP_MIN) * SNAP_MIN
    const startIso = wallClockToUtcIso(date, snapped, tz)
    // Släppte man tillbaka på exakt samma tid och resurs har inget hänt — fråga inte.
    if (staffId === booking.staffId && startIso === booking.startTs) return
    setPendingMove({ booking, staffId, startIso })
  }

  return (
    // `workbench` säger till skalet att den här ytan är ett ARBETSBORD, inte en
    // textsida: den släpper 1320px-spalten och tar hela skärmen (Topnav.module.css).
    <div className={`workbench ${styles.board}`}>
      {/* Verktygsrad — sticky, alltid nåbar, viker till två rader på mobil. */}
      <div className={styles.toolbar}>
        <div className={styles.navGroup}>
          {/* Segmenterad grupp ‹ Idag › — en sammanhållen kontroll som i designen, i
              stället för tre lösa piller. */}
          <div className={styles.navSeg}>
            <button
              type="button"
              className={styles.navSegIcon}
              onClick={() => shift(-1)}
              aria-label="Föregående"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <button
              type="button"
              className={styles.navSegToday}
              onClick={() => go({ datum: today })}
              aria-current={date === today ? 'date' : undefined}
            >
              Idag
            </button>
            <button
              type="button"
              className={styles.navSegIcon}
              onClick={() => shift(1)}
              aria-label="Nästa"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
          {view !== 'manad' && (
            // Ombokningshoppet (B-06): "kom tillbaka om en månad" är frisörens
            // vanligaste framåtblick. Ett klick, samma veckodag fyra veckor fram.
            <button
              type="button"
              className={styles.todayBtn}
              onClick={() => go({ datum: addDaysStr(date, 28) })}
              title="Fyra veckor fram — samma veckodag"
              aria-label="Hoppa fyra veckor fram"
            >
              +4 v
            </button>
          )}
          <div className={styles.periodGroup}>
            <h2 className={styles.periodLabel}>
              {/* Versal första bokstav — sv-SE Intl ger gemener veckodag/månad, designen
                  visar "Onsdag 15 juli". */}
              {(() => {
                const label = view === 'manad' ? monthLabel : dayLabelLong
                return label.charAt(0).toUpperCase() + label.slice(1)
              })()}
            </h2>
            {/* Designens mono-statusrad — bara i dagvyn (server skickar null annars).
                Beläggning och avbokat döljs var för sig när de är 0/saknas: en rad som
                säger "0%" varje morgon är brus, inte information. */}
            {dayStats && (
              <div className={`num ${styles.periodStats}`}>
                <span>v. {dayStats.week}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {dayStats.count} {dayStats.count === 1 ? 'bokning' : 'bokningar'}
                </span>
                {dayStats.occupancy != null && dayStats.occupancy > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{dayStats.occupancy}%</span>
                  </>
                )}
                {dayStats.cancelled > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className={styles.periodStatsBad}>
                      {dayStats.cancelled} avbokad{dayStats.cancelled === 1 ? '' : 'e'}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {/* Resursfilter (B-06). Litet team (salongsfallet) → designens färgprick-chips,
              allt synligt på en gång. Stort team → native <select> som skalar och ger
              telefonen sin inbyggda väljare. Filtret följer med mellan dag/vecka/månad
              oavsett kontroll (resurs bor i URL:en). */}
          {staff.length > 1 && staff.length <= 6 && (
            <div
              className={styles.resChips}
              role="radiogroup"
              aria-label={`Visa en ${staffNoun.toLowerCase()}`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={!resursValid}
                className={`${styles.resChip}${!resursValid ? ` ${styles.resChipOn}` : ''}`}
                onClick={() => go({ resurs: '' })}
              >
                Alla {staff.length}
              </button>
              {staff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={resurs === s.id}
                  className={`${styles.resChip}${resurs === s.id ? ` ${styles.resChipOn}` : ''}`}
                  onClick={() => go({ resurs: resurs === s.id ? '' : s.id })}
                >
                  <span
                    className={styles.resChipDot}
                    style={{ background: s.color }}
                    aria-hidden="true"
                  />
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {staff.length > 6 && (
            <select
              className={styles.resSelect}
              value={resursValid ? resurs : ''}
              onChange={(e) => go({ resurs: e.target.value })}
              aria-label={`Visa en ${staffNoun.toLowerCase()}`}
            >
              <option value="">Alla</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* Sök — "när kommer Anna?" ska inte kräva att man bläddrar vecka för vecka. */}
          <CalendarSearch tz={tz} />

          {/* Ångraloggen — vägen tillbaka från en felavbokning. Ligger i verktygsraden,
              inte på en egen sida: den som just avbokade fel står KVAR i kalendern. */}
          <CancelledLog tz={tz} />

          {/* Hjälp — en diskret knapp, inte en tour. Man öppnar kalendern femtio gånger
              om dagen; en välkomstpopup blir en irritation nio av tio. */}
          <CalendarHelp />

          {/* Vyväxlaren är radiogrupp, inte tre knappar: skärmläsaren ska höra att
              det är ETT val med tre alternativ. */}
          <div className={styles.viewSwitch} role="radiogroup" aria-label="Kalendervy">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={view === v.value}
                className={`${styles.viewBtn}${view === v.value ? ` ${styles.viewBtnOn}` : ''}`}
                onClick={() => go({ vy: v.value })}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Blockera tid har samma mentala modell som att boka: välj vem, när och hur
              länge. Sekundär knapp — det är inte dagens huvudhandling. */}
          <button
            type="button"
            className={styles.blockBtn}
            onClick={() => setBlocking({ seed: null, existing: null })}
          >
            <Icon name="x" size={14} />
            <span>Blockera tid</span>
          </button>

          {/* Utan seed: drawern börjar på tjänstevalet och erbjuder dagens luckor.
              Med ett gridklick ärvs tid + resurs i stället. Två vägar in, EN yta. */}
          <button
            type="button"
            className={styles.newBtn}
            onClick={() => setCreating({ seed: null })}
          >
            <Icon name="plus" size={15} />
            <span>Ny bokning</span>
          </button>
        </div>
      </div>

      {/* Scrollytan. overflow ligger HÄR, inte på sidan — därför scrollar aldrig
          dokumentet och toppnaven stannar kvar. */}
      <div className={styles.scroll}>
        {view === 'dag' && (
          <DayGrid
            bookings={vBookings}
            blocks={vBlocks}
            staff={vStaff}
            staffNoun={staffNoun}
            tz={tz}
            date={date}
            today={today}
            hours={hours}
            dayStart={dayStart}
            gridHeight={gridHeight}
            onOpen={setOpen}
            onBubble={openBubble}
            onEmptyClick={onEmptyClick}
            onDropBooking={onDropBooking}
            onOpenBlock={(block) => setBlocking({ seed: null, existing: block })}
            dragOver={dragOver}
            setDragOver={setDragOver}
          />
        )}
        {view === 'vecka' && (
          <WeekGrid
            bookings={vBookings}
            tz={tz}
            date={date}
            today={today}
            hours={hours}
            dayStart={dayStart}
            gridHeight={gridHeight}
            onOpen={setOpen}
            onBubble={openBubble}
            onDayClick={(d) => go({ vy: 'dag', datum: d })}
            colorOf={colorOf}
          />
        )}
        {view === 'manad' && (
          <MonthGrid
            bookings={vBookings}
            tz={tz}
            date={date}
            today={today}
            onDayClick={(d) => go({ vy: 'dag', datum: d })}
            onOpen={setOpen}
            colorOf={colorOf}
          />
        )}
      </div>

      {bubble && (
        <CalendarBubble
          booking={bubble.booking}
          x={bubble.x}
          y={bubble.y}
          onOpen={(b) => {
            setBubble(null)
            setOpen(b)
          }}
          onClose={() => setBubble(null)}
        />
      )}

      {open && (
        <BookingDrawer
          booking={open}
          tz={tz}
          staffNoun={staffNoun}
          onClose={() => setOpen(null)}
        />
      )}

      {creating && (
        <NewBookingDrawer
          services={services}
          staffNames={staffNames}
          date={date}
          tz={tz}
          locationId={locationId}
          seed={creating.seed}
          onClose={() => setCreating(null)}
        />
      )}

      {blocking && (
        <BlockDrawer
          staff={staff}
          date={date}
          tz={tz}
          seed={blocking.seed}
          existing={blocking.existing}
          onClose={() => setBlocking(null)}
        />
      )}

      {/* Flytt-bekräftelse. Texten beskriver KONSEKVENSEN — vem, från vad, till vad —
          aldrig ett innehållslöst "Är du säker?". Wavys copy-mönster, för det är det
          enda som gör att man vågar dra utan att tveka. */}
      {pendingMove && (
        <Modal
          title="Flytta bokningen?"
          size="sm"
          onClose={() => !moving && setPendingMove(null)}
          ariaLabel="Bekräfta flytt"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setPendingMove(null)}
                disabled={moving}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Avbryt
              </Button>
              <Button
                variant="primary"
                icon="check"
                onClick={confirmMove}
                disabled={moving}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {moving ? 'Flyttar…' : 'Flytta'}
              </Button>
            </>
          }
        >
          <p className={styles.confirmBody}>
            <b>{pendingMove.booking.serviceName}</b> för{' '}
            <b>{pendingMove.booking.customerName?.trim() || 'Gäst'}</b>
          </p>
          <div className={styles.moveDiff}>
            <div className={styles.moveFrom}>
              <span className="eyebrow">Från</span>
              <span className="num">
                {timeLabel(pendingMove.booking.startTs, tz)} · {pendingMove.booking.staffTitle}
              </span>
            </div>
            <Icon name="arrowRight" size={16} />
            <div className={styles.moveTo}>
              <span className="eyebrow">Till</span>
              <span className="num">
                {timeLabel(pendingMove.startIso, tz)} · {staffNames.get(pendingMove.staffId)}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** Luften ovanför första timstrecket (calendar.module.css `.body { padding-top }`).
 *  Kolumnerna är grid-items och börjar EFTER paddingen; nu-linjen ligger absolut i
 *  .body och räknar från padding-boxens topp — utan detta påslag skulle den peka
 *  10px fel, alltså ~7 minuter. */
const GRID_PAD = 10

/** Nu-linjen — bara på dagens datum, aldrig på en dag i framtiden (då ljuger den).
 *  `offset` är GRID_PAD när linjen ligger direkt i .body (dagvyn spänner alla
 *  kolumner) och 0 när den ligger inuti en kolumn (veckovyn) — kolumnen har redan
 *  paddingen bakom sig. */
function NowLine({ dayStart, tz, offset = 0 }: { dayStart: number; tz: string; offset?: number }) {
  const nowMin = minutesInTz(new Date().toISOString(), tz)
  const top = (nowMin - dayStart) * PX_PER_MIN
  if (top < 0) return null
  return <div className={styles.nowLine} style={{ top: top + offset }} aria-hidden="true" />
}

/** Håll-tid innan en tryckning på tom yta räknas som "jag vill boka HÄR". */
const HOLD_MS = 320
/** Rör fingret sig mer än så är det en scroll, inte en tryckning. */
const SLOP_PX = 10

/**
 * Ledig yta i kalendern — "tryck där du vill boka".
 *
 * MED MUS: ett klick, direkt. Ingen fördröjning, inget att lära sig.
 *
 * MED FINGER: ett vanligt tryck gör INGENTING. Man måste hålla kvar ~320 ms utan att
 * flytta fingret. Varför: kalendern scrollar i båda led, och på en telefon avslutas en
 * scroll ofta med att man nuddar ytan för att stoppa rullningen — den nudden öppnade
 * förut bokningsdialogen. Att avbryta en dialog man aldrig bad om är värre än att
 * behöva hålla in en tredjedels sekund. Rör fingret sig mer än 10 px, eller lyfts det
 * före tiden, händer ingenting alls.
 *
 * Ytan får en tydlig markering under hållet (.freeAreaArmed) så det syns att systemet
 * lyssnar — annars känns fördröjningen som en bugg i stället för en spärr.
 *
 * TANGENTBORD: Enter/Space på knappen fungerar som förut (öppnar mitt i ytan).
 */
function FreeArea({
  staffName,
  onPick,
}: {
  staffName: string
  onPick: (clientY: number, box: DOMRect) => void
}) {
  const [armed, setArmed] = useState(false)
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)

  const cancel = () => {
    if (hold.current) clearTimeout(hold.current.timer)
    hold.current = null
    setArmed(false)
  }

  return (
    <button
      type="button"
      className={`${styles.freeArea}${armed ? ` ${styles.freeAreaArmed}` : ''}`}
      aria-label={`Boka ledig tid hos ${staffName}`}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return // musen går på onClick
        const el = e.currentTarget
        const { clientX: x, clientY: y } = e
        setArmed(true)
        hold.current = {
          x,
          y,
          timer: setTimeout(() => {
            hold.current = null
            setArmed(false)
            onPick(y, el.getBoundingClientRect())
          }, HOLD_MS),
        }
      }}
      onPointerMove={(e) => {
        const h = hold.current
        if (!h) return
        if (Math.abs(e.clientX - h.x) > SLOP_PX || Math.abs(e.clientY - h.y) > SLOP_PX) cancel()
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onClick={(e) => {
        // Touch har redan hanterats i pointer-flödet; det syntetiska click:et som följer
        // ett tryck får INTE öppna dialogen en gång till (eller alls, om hållet avbröts).
        if (e.detail === 0) {
          // detail === 0 → tangentbord (Enter/Space), inte en riktig pekare. Öppna mitt
          // i ytan: en tangentbordsanvändare har ingen y-koordinat att sikta med.
          const box = e.currentTarget.getBoundingClientRect()
          onPick(box.top + box.height / 2, box)
          return
        }
        const pt = (e.nativeEvent as Partial<PointerEvent>).pointerType
        if (pt && pt !== 'mouse') return
        onPick(e.clientY, e.currentTarget.getBoundingClientRect())
      }}
    />
  )
}

/** Klick-bubblan (designens signatur). Öppnas vid pekar-/touch-klick på ett block med
 *  Ring (bara om nummer) + Öppna. Ligger `fixed` vid klickpunkten, klamrad innanför
 *  viewporten. Fokus flyttas in, Escape och klick utanför stänger — så den funkar även
 *  för touch och screenreader, inte bara mus. Renderas bara på klient (efter interaktion),
 *  så `window` finns alltid här. */
function CalendarBubble({
  booking,
  x,
  y,
  onOpen,
  onClose,
}: {
  booking: BookingRow
  x: number
  y: number
  onOpen: (b: BookingRow) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const tel = telHref(booking.customerPhone)

  useEffect(() => {
    // Var fokus låg innan bubblan (det klickade blocket) — återställs vid stängning så
    // Escape/scrim inte tappar fokus till <body>. Öppna-vägen öppnar drawern som sedan
    // tar fokus själv (monteras efter att bubblan avmonterats). (Codex-granskning, MEDEL.)
    const prev = document.activeElement as HTMLElement | null
    const box = ref.current
    const focusables = () => Array.from(box?.querySelectorAll<HTMLElement>('a,button') ?? [])
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Minimal fokusfälla: Tab cyklar inom bubblans knappar, lämnar den aldrig bakom scrimen.
      if (e.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return
        const first = items[0]!
        const last = items[items.length - 1]!
        const active = document.activeElement
        if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // Återställ bara om fokus fortfarande ligger kvar i bubblan (Öppna-vägen har redan
      // flyttat det vidare till drawern — rör det inte då).
      if (box && box.contains(document.activeElement)) prev?.focus?.()
    }
  }, [onClose])

  // Klamra innanför viewporten så bubblan aldrig hamnar delvis utanför kanten.
  const left = Math.min(Math.max(x, 96), window.innerWidth - 96)
  const top = Math.max(y - 14, 64)
  const name = booking.customerName?.trim() || 'Gäst'

  return (
    <>
      <div className={styles.bubbleScrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={styles.bubble}
        style={{ left, top }}
        role="dialog"
        aria-label={`Åtgärder för ${name}`}
      >
        {tel && (
          <a href={tel} className={styles.bubbleRing} onClick={onClose}>
            <Icon name="phone" size={14} />
            Ring
          </a>
        )}
        <button type="button" className={styles.bubbleOpen} onClick={() => onOpen(booking)}>
          Öppna
        </button>
      </div>
    </>
  )
}

function BookingBlock({
  booking,
  tz,
  top,
  height,
  lane,
  lanes,
  onOpen,
  onBubble,
  draggable,
  showPhone,
  color,
}: {
  booking: BookingRow
  tz: string
  top: number
  height: number
  lane: number
  lanes: number
  onOpen: (b: BookingRow) => void
  /** Pekar-/touch-klick → bubbla vid pekaren. Utelämnad (t.ex. framtida ytor) → onOpen. */
  onBubble?: (b: BookingRow, x: number, y: number) => void
  /** goal-67: den bokade personens färg (hex). Bär "vems tid är det?" — den fråga
   *  en full dag ställer oftast. Aldrig ensam bärare: initialerna står i kortet och
   *  status har fortfarande ikon + text. */
  color: string
  /** Avbokade tider går inte att flytta — och veckovyn saknar resurskolumner att
   *  släppa i, så dragning är avstängd där. */
  draggable?: boolean
  /** Dagvyn: blocken är breda nog för kundens telefonnummer. I vecko-/månadsvyn
   *  finns inte pixlarna — och där jobbar man inte heller "ring nästa kund". */
  showPhone?: boolean
}) {
  const dim = isAvbokad(booking.status)
  const name = booking.customerName?.trim() || 'Gäst'

  // Ett block är bara så högt som tiden är lång — texten måste anpassa sig, inte
  // klippas mitt i en rad.
  //
  // FIXAT (Zivars mobilskärmdump): nivåerna var gissade, inte räknade. En 30-min-tid är
  // 42px hög (30 × PX_PER_MIN 1.4). Den föll på "≥ 34 → medium" och fick FYRA rader —
  // tid (13px) + namn (16) + tjänst (14) + status (13) = 56px text i ett block med 32px
  // fri höjd (42 minus 10px padding). Resultatet var exakt det på skärmdumpen:
  // "Gäst" och "Herrklippnin" avhuggna mitt i tecknen.
  //
  // Nu räknas nivåerna ur radhöjderna i CSS:en, med paddingen avdragen:
  //   ≥ 66px  allt        tid + namn + tjänst + telefon   (13+16+14+13 = 56 + 10)
  //   ≥ 52px  medium      tid + namn + tjänst             (43 + 10)
  //   ≥ 38px  compact     tid + namn                      (29 + 10)  ← 30-min-tiden
  //   < 38px  tiny        EN rad: tid och namn sida vid sida
  //
  // Statusflaggan tar INGEN höjd längre — den ligger absolut i kortets hörn (.blockFlag)
  // i stället för att vara en femte rad som trängde ut tjänsten. Texten viker; det gör
  // aldrig informationen: allt finns i title, aria-label och drawern.
  const h = Math.max(height, 20)
  const tier = h >= 66 ? 'full' : h >= 52 ? 'medium' : h >= 38 ? 'compact' : 'tiny'
  const showService = tier === 'full' || tier === 'medium'
  // Avbokad tid → inget nummer. Att ringa någon som redan avbokat är precis det
  // misstag ett synligt nummer inbjuder till.
  const phone = showPhone && !dim ? booking.customerPhone : null
  // Uteblivet besök har EGEN ikon + egen text — det får aldrig se ut som en avbokning
  // (avbokat = besked i tid; uteblivet = förlorad intäkt och förlorad tid).
  const statusFlag =
    booking.status === 'pending'
      ? { icon: 'alert' as const, text: 'Obekräftad' }
      : isKlar(booking.status)
        ? { icon: 'check' as const, text: 'Klar' }
        : booking.status === 'no_show'
          ? { icon: 'clock' as const, text: 'Uteblev' }
          : dim
            ? { icon: 'x' as const, text: 'Avbokad' }
            : null

  return (
    <button
      type="button"
      className={`${styles.block}${dim ? ` ${styles.blockDim}` : ''}${draggable ? ` ${styles.blockDrag}` : ''}${tier === 'tiny' ? ` ${styles.blockTiny}` : ''}`}
      style={{
        top,
        height: h,
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
        // Personens färg äger kortet (kant + toning, se calendar.module.css).
        // Statusen bär sin egen ikon + text, så den behöver inte kanten längre.
        ['--bk' as string]: color,
        ['--bk-status' as string]: statusAccent(booking.status),
      }}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', booking.id)
        e.dataTransfer.effectAllowed = 'move'
        draggingId = booking.id
      }}
      onDragEnd={() => {
        draggingId = null
      }}
      onClick={(e) => {
        // Tangentbord (Enter/Space) ger detail===0 → öppna drawern direkt: en bubbla
        // finns ingen pekare att sikta med. Pekare/touch → bubblan vid klickpunkten.
        if (e.detail === 0 || !onBubble) onOpen(booking)
        else onBubble(booking, e.clientX, e.clientY)
      }}
      title={`${timeLabel(booking.startTs, tz)}–${timeLabel(booking.endTs, tz)} · ${name} · ${booking.serviceName}`}
      aria-label={`${timeLabel(booking.startTs, tz)}–${timeLabel(booking.endTs, tz)} ${name}, ${booking.serviceName}, ${booking.staffTitle}${statusFlag ? `, ${statusFlag.text}` : ''}`}
    >
      <span className={`num ${styles.blockTime}`}>{timeLabel(booking.startTs, tz)}</span>
      <span className={styles.blockName}>{name}</span>
      {showService && <span className={styles.blockService}>{booking.serviceName}</span>}
      {/* Numret står som TEXT här, inte som länk: blocket är redan en <button>, och en
          <a> inuti en <button> är ogiltig HTML som skärmläsare tolkar olika. Ringbart
          blir det i dialogen — ett klick bort, precis som önskat. */}
      {tier === 'full' && phone && (
        <span className={`num ${styles.blockPhone}`}>
          <Icon name="phone" size={10} />
          {phone}
        </span>
      )}
      {/* Status bärs av ikon (+ text när kortet är stort nog), aldrig av färgen ensam
          — färgblinda och gråskala måste kunna läsa den. Flaggan ligger ABSOLUT i
          hörnet: som flödesrad åt den förut höjd från tjänsten och klippte texten. */}
      {statusFlag && (
        <span
          className={`${styles.blockFlag}${tier === 'full' ? ` ${styles.blockFlagFull}` : ''}`}
          title={statusFlag.text}
        >
          <Icon name={statusFlag.icon} size={11} />
          {tier === 'full' && <span>{statusFlag.text}</span>}
        </span>
      )}
      {/* goal-67 — VEMS TID? I dagvyn svarar kolumnen. I VECKOVYN finns ingen kolumn,
          och då vore färgen ensam bärare — det bryter regeln. Initialerna gör färgen
          till en genväg i stället för det enda svaret. (Codex-granskning, MEDEL.) */}
      {!showPhone && tier !== 'tiny' && (
        <span className={styles.blockWho} style={{ background: color }}>
          {staffInitials(booking.staffTitle)}
        </span>
      )}
    </button>
  )
}

/** Blockerad tid. Skiljs från en bokning med MER än färg: diagonalt mönster + ikon +
 *  orsakstext. Måste gå att läsa i gråskala och av en färgblind användare.
 *  Klickbar — det är så man tar bort den (samma mönster som en bokning: klicka på
 *  saken du vill ändra). */
function BlockBlock({
  block,
  tz,
  top,
  height,
  onOpen,
}: {
  block: CalendarBlock
  tz: string
  top: number
  height: number
  onOpen: (b: CalendarBlock) => void
}) {
  return (
    <button
      type="button"
      className={styles.blocked}
      style={{ top, height: Math.max(height, 18) }}
      onClick={() => onOpen(block)}
      aria-label={`Blockerad ${timeLabel(block.startTs, tz)}–${timeLabel(block.endTs, tz)}: ${block.reason}. Öppna för att ta bort.`}
    >
      <span className={styles.blockedText}>
        <Icon name="x" size={11} /> {block.reason}
      </span>
    </button>
  )
}

function DayGrid({
  bookings,
  blocks,
  staff,
  staffNoun,
  tz,
  date,
  today,
  hours,
  dayStart,
  gridHeight,
  onOpen,
  onBubble,
  onEmptyClick,
  onDropBooking,
  onOpenBlock,
  dragOver,
  setDragOver,
}: {
  bookings: BookingRow[]
  blocks: CalendarBlock[]
  staff: CalendarStaff[]
  /** Branschens ord för en resurs-kolumn ('Stylist', 'Florist', 'Formgivare' …),
   *  resolvad ur tenantens terminologi. Kalendern antar aldrig en bransch. */
  staffNoun: string
  tz: string
  date: string
  today: string
  hours: number[]
  dayStart: number
  gridHeight: number
  onOpen: (b: BookingRow) => void
  onBubble: (b: BookingRow, x: number, y: number) => void
  onEmptyClick: (staffId: string, staffName: string, minute: number) => void
  onDropBooking: (booking: BookingRow, staffId: string, minute: number) => void
  onOpenBlock: (block: CalendarBlock) => void
  dragOver: { staffId: string; minute: number; durationMin: number } | null
  setDragOver: (v: { staffId: string; minute: number; durationMin: number } | null) => void
}) {
  if (staff.length === 0) {
    return (
      <p className={styles.empty}>
        Ingen {staffNoun.toLowerCase()} upplagd ännu. Lägg till {staffNoun.toLowerCase()} under
        Inställningar, så får kalendern sina kolumner.
      </p>
    )
  }

  return (
    <div className={styles.dayWrap} style={{ ['--cols' as string]: staff.length }}>
      {/* Resurshuvudena är sticky: scrollar man ner i dagen ser man fortfarande vems
          kolumn man tittar i. */}
      <div className={styles.head}>
        <div className={styles.headSpacer} />
        {staff.map((s) => {
          // "N idag" = personens LEVANDE bokningar (avbokat/uteblivet räknas inte som
          // dagens arbete). Samma sanning som lastsiffran i designens kolumnhuvud.
          const load = bookings.filter((b) => b.staffId === s.id && !isAvbokad(b.status)).length
          return (
            <div
              key={s.id}
              className={`${styles.headCell} ${styles.headCellDay}`}
              // 2px färglinje under huvudet (designens box-shadow) — färgen förstärker
              // kolumnidentiteten men bärs aldrig ensam: namn + avatar-initialer står kvar.
              style={{ ['--bk' as string]: s.color }}
            >
              <span className={styles.headAvatar} aria-hidden="true">
                {(s.name.trim()[0] ?? '?').toUpperCase()}
              </span>
              <span className={styles.headText}>
                <span className={styles.headName}>{s.name}</span>
                <span className={`num ${styles.headHours}`}>
                  {s.start && s.end ? `${s.start.slice(0, 5)}–${s.end.slice(0, 5)}` : 'Ledig'}
                </span>
              </span>
              <span className={`num ${styles.headLoad}`}>{load} idag</span>
            </div>
          )
        })}
      </div>

      <div className={styles.body} style={{ height: gridHeight }}>
        <TimeAxis hours={hours} dayStart={dayStart} />

        {staff.map((s) => {
          const mine = bookings.filter((b) => b.staffId === s.id)
          const placed = placeOverlaps(mine, tz)
          const workStart = s.start ? toMin(s.start) : null
          const workEnd = s.end ? toMin(s.end) : null
          return (
            <div
              key={s.id}
              className={styles.col}
              onDragOver={(e) => {
                // Utan preventDefault vägrar webbläsaren ta emot släppet.
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                const box = e.currentTarget.getBoundingClientRect()
                const raw = dayStart + (e.clientY - box.top) / PX_PER_MIN
                const snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN
                // Längden på det dragna blocket måste vara känd redan här, annars kan
                // förhandsvisningen inte visa var tiden SLUTAR. Den läses ur draget.
                const dragged = bookings.find((b) => b.id === draggingId)
                const durationMin = dragged
                  ? (minutesInTz(dragged.endTs, tz) - minutesInTz(dragged.startTs, tz))
                  : 30
                if (
                  !dragOver ||
                  dragOver.staffId !== s.id ||
                  dragOver.minute !== snapped ||
                  dragOver.durationMin !== durationMin
                ) {
                  setDragOver({ staffId: s.id, minute: snapped, durationMin })
                }
              }}
              onDragLeave={(e) => {
                // Bara när markören lämnar KOLUMNEN, inte när den passerar ett barn.
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOver?.staffId === s.id) setDragOver(null)
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(null)
                const id = e.dataTransfer.getData('text/plain')
                const dropped = bookings.find((b) => b.id === id)
                if (!dropped) return
                const box = e.currentTarget.getBoundingClientRect()
                const minute = dayStart + (e.clientY - box.top) / PX_PER_MIN
                onDropBooking(dropped, s.id, minute)
              }}
            >
              {/* Ej arbetstid skuggas — men kolumnen finns kvar. En ledig resurs är
                  information, inte en tom lucka i rutnätet. */}
              {workStart != null && workEnd != null ? (
                <>
                  <div
                    className={styles.offHours}
                    style={{ top: 0, height: Math.max((workStart - dayStart) * PX_PER_MIN, 0) }}
                  />
                  <div
                    className={styles.offHours}
                    style={{
                      top: (workEnd - dayStart) * PX_PER_MIN,
                      bottom: 0,
                    }}
                  />
                </>
              ) : (
                <div className={styles.offHours} style={{ top: 0, bottom: 0 }} />
              )}

              <HourLines hours={hours} dayStart={dayStart} />

              {/* Ledig yta är klickbar — Wavys "klicka där du vill boka". Fungerar
                  också med tangentbord (Enter/Space på knappen). På TOUCH krävs en
                  avsiktlig tryckning, se FreeArea. */}
              <FreeArea
                staffName={s.name}
                onPick={(clientY, box) => {
                  const minute = dayStart + (clientY - box.top) / PX_PER_MIN
                  onEmptyClick(s.id, s.name, minute)
                }}
              />

              {/* Blockeringar ritas UNDER bokningarna: en bokning i blockerad tid
                  (t.ex. inlagd före rasten) måste ändå gå att klicka på. */}
              {blocks
                .filter((bl) => bl.staffId === s.id)
                .map((bl) => (
                  <BlockBlock
                    key={bl.id}
                    block={bl}
                    tz={tz}
                    top={(minutesInTz(bl.startTs, tz) - dayStart) * PX_PER_MIN}
                    height={
                      (minutesInTz(bl.endTs, tz) - minutesInTz(bl.startTs, tz)) * PX_PER_MIN
                    }
                    onOpen={onOpenBlock}
                  />
                ))}

              {placed.map(({ booking, lane, lanes }) => (
                <BookingBlock
                  key={booking.id}
                  booking={booking}
                  tz={tz}
                  top={(minutesInTz(booking.startTs, tz) - dayStart) * PX_PER_MIN}
                  height={
                    (minutesInTz(booking.endTs, tz) - minutesInTz(booking.startTs, tz)) * PX_PER_MIN
                  }
                  lane={lane}
                  lanes={lanes}
                  onOpen={onOpen}
                  onBubble={onBubble}
                  draggable={!isAvbokad(booking.status)}
                  showPhone
                  color={s.color}
                />
              ))}

              {/* Förhandsvisning under draget: exakt var tiden landar, med sluttiden
                  uträknad. Man ser resultatet innan man släpper — det är det som gör
                  draget tryggt i stället för en gissning. */}
              {dragOver?.staffId === s.id && (
                <div
                  className={styles.dropPreview}
                  style={{
                    top: (dragOver.minute - dayStart) * PX_PER_MIN,
                    height: Math.max(dragOver.durationMin * PX_PER_MIN, 22),
                  }}
                  aria-hidden="true"
                >
                  <span className="num">
                    {fromMin(dragOver.minute)}–{fromMin(dragOver.minute + dragOver.durationMin)}
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {date === today && <NowLine dayStart={dayStart} tz={tz} offset={GRID_PAD} />}
      </div>
    </div>
  )
}

function WeekGrid({
  bookings,
  tz,
  date,
  today,
  hours,
  dayStart,
  gridHeight,
  onOpen,
  onBubble,
  onDayClick,
  colorOf,
}: {
  bookings: BookingRow[]
  tz: string
  date: string
  today: string
  hours: number[]
  dayStart: number
  gridHeight: number
  onOpen: (b: BookingRow) => void
  onBubble: (b: BookingRow, x: number, y: number) => void
  onDayClick: (date: string) => void
  colorOf: (staffId: string) => string
}) {
  // Veckans sju dagar från måndagen i den valda veckan.
  const monday = useMemo(() => {
    const d = new Date(`${date}T12:00:00Z`)
    const dow = d.getUTCDay()
    d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
    return d
  }, [date])

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setUTCDate(d.getUTCDate() + i)
        return d.toISOString().slice(0, 10)
      }),
    [monday],
  )

  return (
    <div className={styles.dayWrap} style={{ ['--cols' as string]: 7 }}>
      <div className={styles.head}>
        <div className={styles.headSpacer} />
        {days.map((d) => {
          const label = new Intl.DateTimeFormat('sv-SE', {
            weekday: 'short',
            day: 'numeric',
            timeZone: tz,
          }).format(new Date(`${d}T12:00:00Z`))
          return (
            <button
              key={d}
              type="button"
              className={`${styles.headCell} ${styles.headCellBtn}${d === today ? ` ${styles.headToday}` : ''}`}
              onClick={() => onDayClick(d)}
            >
              <span className={styles.headName}>{label}</span>
              <span className={styles.headHours}>Öppna dagen</span>
            </button>
          )
        })}
      </div>

      <div className={styles.body} style={{ height: gridHeight }}>
        <TimeAxis hours={hours} dayStart={dayStart} />

        {days.map((d) => {
          // Alla resurser överlagras i veckovyn — DÄRFÖR bär färgen mest här: sju
          // dagar utan resurskolumner, och ändå ska man se vems tid det är. Namnet
          // står kvar på blocket, så färgen är en genväg, inte den enda vägen.
          const mine = bookings.filter((b) => dayKey(b.startTs, tz) === d)
          const placed = placeOverlaps(mine, tz)
          return (
            <div key={d} className={styles.col}>
              <HourLines hours={hours} dayStart={dayStart} />
              {placed.map(({ booking, lane, lanes }) => (
                <BookingBlock
                  key={booking.id}
                  booking={booking}
                  tz={tz}
                  top={(minutesInTz(booking.startTs, tz) - dayStart) * PX_PER_MIN}
                  height={
                    (minutesInTz(booking.endTs, tz) - minutesInTz(booking.startTs, tz)) * PX_PER_MIN
                  }
                  lane={lane}
                  lanes={lanes}
                  onOpen={onOpen}
                  onBubble={onBubble}
                  color={colorOf(booking.staffId)}
                />
              ))}
              {d === today && <NowLine dayStart={dayStart} tz={tz} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthGrid({
  bookings,
  tz,
  date,
  today,
  onDayClick,
  onOpen,
  colorOf,
}: {
  bookings: BookingRow[]
  tz: string
  date: string
  today: string
  onDayClick: (date: string) => void
  onOpen: (b: BookingRow) => void
  colorOf: (staffId: string) => string
}) {
  const { cells, month } = useMemo(() => {
    const anchor = new Date(`${date}T12:00:00Z`)
    const month = anchor.getUTCMonth()
    const first = new Date(Date.UTC(anchor.getUTCFullYear(), month, 1, 12))
    const dow = first.getUTCDay()
    const gridStart = new Date(first)
    gridStart.setUTCDate(first.getUTCDate() + (dow === 0 ? -6 : 1 - dow))

    const cells: { key: string; inMonth: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setUTCDate(gridStart.getUTCDate() + i)
      cells.push({ key: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === month })
      // Sluta efter hel vecka när månaden är slut — annars ritas en tom sjätte rad.
      if (i >= 27 && d.getUTCDay() === 0 && d.getUTCMonth() !== month) break
    }
    return { cells, month }
  }, [date])

  // goal-67: månadsvyn visar BOKNINGARNA, inte bara ett antal. "3 bokningar" tvingar
  // fram ett extra klick för att se VAD som är bokat — och det klicket är hela frågan.
  // Korten får hela dagcellens bredd (tid · namn · tjänst på en rad som andas), och
  // dagen som inte får plats säger ärligt "+N fler" i stället för att klippa texten.
  const perDay = useMemo(() => {
    const map = new Map<string, BookingRow[]>()
    for (const b of bookings) {
      const key = dayKey(b.startTs, tz)
      const list = map.get(key)
      if (list) list.push(b)
      else map.set(key, [b])
    }
    // Kronologiskt inom dagen — kalendern läses uppifrån och ner, alltid.
    for (const list of map.values()) list.sort((a, b) => a.startTs.localeCompare(b.startTs))
    return map
  }, [bookings, tz])

  const weekdays = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön']

  return (
    <div className={styles.month}>
      <div className={styles.monthHead}>
        {weekdays.map((w) => (
          <span key={w} className={styles.monthHeadCell}>
            {w}
          </span>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {cells.map(({ key, inMonth }) => {
          const all = perDay.get(key) ?? []
          const live = all.filter((b) => !isAvbokad(b.status))
          const dayNum = Number(key.slice(8, 10))
          // Cellen är rullbar (CSS), så en FULL dag tappar aldrig en bokning — men vi
          // renderar inte 40 kort i 42 celler heller. Taket är generöst; resten
          // sammanfattas och dagvyn är ett klick bort.
          const MAX = 8
          const shown = live.slice(0, MAX)
          const rest = live.length - shown.length
          return (
            <div
              key={key}
              className={`${styles.monthCell}${inMonth ? '' : ` ${styles.monthCellOut}`}${key === today ? ` ${styles.monthCellToday}` : ''}`}
            >
              {/* Dagnumret ÄR vägen till dagvyn — hela cellen kan inte vara en knapp
                  längre, för korten inuti den är egna knappar (ogiltig HTML annars). */}
              <button
                type="button"
                className={styles.monthDayBtn}
                onClick={() => onDayClick(key)}
                aria-label={`Öppna ${key} i dagvyn, ${live.length} bokningar`}
              >
                <span className={`num ${styles.monthDayNum}`}>{dayNum}</span>
                {live.length > 0 && (
                  <span className={`num ${styles.monthDayCount}`}>{live.length}</span>
                )}
              </button>

              <div className={styles.monthList}>
                {shown.map((b) => (
                  <MonthBooking key={b.id} booking={b} tz={tz} color={colorOf(b.staffId)} onOpen={onOpen} />
                ))}
                {rest > 0 && (
                  <button type="button" className={styles.monthMore} onClick={() => onDayClick(key)}>
                    +<span className="num">{rest}</span> fler
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Ett bokningskort i månadsvyn. Samma information som i dagvyn — tid, kund, tjänst,
 *  personens färg — men på EN rad som får hela cellens bredd. Texten kapas aldrig i
 *  onödan: cellen är bredare än ett Wavy-kort, och det som ändå inte får plats
 *  ellipseras i tjänsten (sist), aldrig i namnet. */
function MonthBooking({
  booking,
  tz,
  color,
  onOpen,
}: {
  booking: BookingRow
  tz: string
  color: string
  onOpen: (b: BookingRow) => void
}) {
  const name = booking.customerName?.trim() || 'Gäst'
  const pending = booking.status === 'pending'
  const noShow = booking.status === 'no_show'
  // Månadsvyn har minst plats av alla — men statusen får ändå aldrig bäras av färg
  // ensam: ikonen + skärmläsartexten följer med.
  const flag = pending
    ? { icon: 'alert' as const, text: 'obekräftad' }
    : noShow
      ? { icon: 'clock' as const, text: 'uteblev' }
      : null
  return (
    <button
      type="button"
      className={styles.mBk}
      style={{ ['--bk' as string]: color }}
      onClick={() => onOpen(booking)}
      title={`${timeLabel(booking.startTs, tz)} · ${name} · ${booking.serviceName} · ${booking.staffTitle}${noShow ? ' · Uteblev' : ''}`}
      aria-label={`${timeLabel(booking.startTs, tz)} ${name}, ${booking.serviceName}, ${booking.staffTitle}${flag ? `, ${flag.text}` : ''}`}
    >
      <span className={`num ${styles.mBkTime}`}>{timeLabel(booking.startTs, tz)}</span>
      <span className={styles.mBkName}>{name}</span>
      {/* Initialerna, inte bara färgen — månadsvyn har inga resurskolumner, så utan dem
          vore färgen ensam bärare av "vems tid?". (Codex-granskning, MEDEL.) */}
      <span className={styles.mBkWho} style={{ background: color }}>
        {staffInitials(booking.staffTitle)}
      </span>
      <span className={styles.mBkService}>{booking.serviceName}</span>
      {booking.customerPhone && (
        <span className={`num ${styles.mBkPhone}`}>{booking.customerPhone}</span>
      )}
      {flag && (
        <span className={styles.mBkFlag} aria-hidden="true">
          <Icon name={flag.icon} size={10} />
        </span>
      )}
    </button>
  )
}
