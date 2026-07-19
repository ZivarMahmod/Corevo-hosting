'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { addDays, addMonths, dayKey, isoWeekNumber } from '@/lib/admin/dates'
import { occupancyPct } from '@/lib/admin/dashboard-view'
import { moveBooking } from '@/lib/admin/calendar-actions'
import { Button, Icon, Modal, useToast } from '@/components/portal/ui'
import dynamic from 'next/dynamic'
import {
  BookingDrawer,
  eligibleRescheduleStaff,
  isAvbokad,
  isBokad,
  isKlar,
  statusAccent,
  timeLabel,
  type BookingRow,
} from './BookingDrawer'
import type { CalendarService, NewBookingSeed } from './NewBookingDrawer'

// Prestanda B4: dynamic() splittar dessa fyra ur kalenderns HUVUD-chunk (~40-50 kB).
// NewBookingDrawer + BlockDrawer renderas villkorligt (creating/blocking-state) → chunken
// hämtas först vid klick. CalendarHelp + CancelledLog monteras alltid (deras trigger-knapp
// syns i verktygsraden; bara modal-innehållet är klick-gatat) → deras chunk hämtas vid
// mount, men ligger fortfarande UTANFÖR huvud-chunken (mindre initial parse). BookingDrawer
// lämnas STATISK: den delar modul med synkrona render-hjälpare (isAvbokad/isKlar/
// statusAccent/timeLabel) som CalendarBoard behöver eagerly — att splitta drar in modulen ändå.
const NewBookingDrawer = dynamic(() => import('./NewBookingDrawer').then((m) => m.NewBookingDrawer))
const BlockDrawer = dynamic(() => import('./BlockDrawer').then((m) => m.BlockDrawer))
const CalendarHelp = dynamic(() => import('./CalendarHelp').then((m) => m.CalendarHelp))
const CancelledLog = dynamic(() => import('./CancelledLog').then((m) => m.CancelledLog))
import { CalendarSearch } from './CalendarSearch'
import { staffColor, staffInitials } from '@/lib/admin/staff-colors'
import {
  MOBILE_CALENDAR_DATE_EVENT,
  MOBILE_CALENDAR_META_EVENT,
  MOBILE_CALENDAR_META_REQUEST_EVENT,
  MOBILE_CALENDAR_SHIFT_EVENT,
} from '@/components/portal/mobile-search-event'
import styles from './calendar.module.css'
import { nearestDaySlide } from './calendar-pager'
import {
  TOUCH_DRAG_HOLD_MS,
  TOUCH_DRAG_SLOP_PX,
  dragGhostPosition,
  edgeAutoScrollVelocity,
} from './calendar-gestures'

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
  /** Resurskopplingarna bakom ombokningsväljaren; båda är tenant-fencade på servern. */
  serviceIds: string[]
  locationIds: string[]
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

export type CalendarDayData = {
  date: string
  bookings: BookingRow[]
  blocks: CalendarBlock[]
  staff: CalendarStaff[]
}

export type CalendarDayNeighbors = {
  previous: CalendarDayData
  next: CalendarDayData
}

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'dag', label: 'Dag' },
  { value: 'vecka', label: 'Vecka' },
  { value: 'manad', label: 'Månad' },
]

/** Rutnätets upplösning. 15 min är snappningen (Wavy gör samma): ett klick på
 *  09:20-höjd ger 09:15, aldrig 09:20. */
const SNAP_MIN = 15

/** Pixlar per minut. Styr höjden på en bokning: 60 min = 84 px. Räcker för att läsa
 *  kund + tjänst i ett 30-minuterspass utan att dagen blir orimligt lång. */
const PX_PER_MIN = 1.4

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h! * 60 + m!
}
const fromMin = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export type CalendarLaunchMode = 'new' | 'block' | null

/** Djuplänkens skapaflöde. Ny bokning vinner uttryckligen om en gammal/delad URL
 * råkar innehålla båda parametrarna. */
export function calendarLaunchMode(params: Pick<URLSearchParams, 'get'>): CalendarLaunchMode {
  if (params.get('ny') !== null) return 'new'
  if (params.get('blockera') !== null) return 'block'
  return null
}

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
  const sorted = [...items].sort((a, b) => minutesInTz(a.startTs, tz) - minutesInTz(b.startTs, tz))
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

export type CalendarBoardProps = {
  bookings: BookingRow[]
  blocks: CalendarBlock[]
  staff: CalendarStaff[]
  /** Dagvyns två sidorslides. Mittendagens data är fortsatt toppnivåprops. */
  dayNeighbors?: CalendarDayNeighbors
  services: CalendarService[]
  tz: string
  view: CalendarView
  date: string
  staffNoun: string
  locationId?: string
  today: string
  openBookingId?: string
  onlinePaymentsActive: boolean
  /** 0077-mutationerna kräver organisations-/platsadmin. Personal får läsa arbetsdagen. */
  canManageBookings: boolean
}

export function CalendarBoard({
  bookings,
  blocks,
  staff,
  dayNeighbors,
  services,
  tz,
  view,
  date,
  staffNoun,
  locationId,
  /** Dagens datum i salongens tidszon — "Idag"-knappen och nu-linjen utgår från det. */
  today,
  openBookingId,
  onlinePaymentsActive,
  canManageBookings,
}: CalendarBoardProps) {
  const router = useRouter()
  const params = useSearchParams()
  const absenceTimeOffId = params.get('absence')
  const scrollRef = useRef<HTMLDivElement>(null)
  const pagerNavigationLocked = useRef(false)
  const pagerScrollLeft = useRef(0)
  const pagerSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeDaySlide, setActiveDaySlide] = useState(1)
  const [pagerNavigationPending, setPagerNavigationPending] = useState(false)
  const [announcedDay, setAnnouncedDay] = useState(date)
  const [open, setOpen] = useState<BookingRow | null>(
    () => bookings.find((b) => b.id === openBookingId) ?? null,
  )
  /** null = stängd. Ett objekt (ev. med seed) = skapa-läge. Översiktens genväg
   *  "Ny bokning" djuplänkar hit med ?ny → drawern öppnas direkt vid landning. */
  const [creating, setCreating] = useState<{ seed: NewBookingSeed | null } | null>(() =>
    canManageBookings && calendarLaunchMode(params) === 'new' ? { seed: null } : null,
  )
  /** Blockera tid: ny (seed från gridklick eller tom) eller befintlig (öppnad blockering).
   *  Genvägen "Blockera tid" djuplänkar hit med ?blockera. Ömsesidigt uteslutande med
   *  ?ny — bara en drawer öppnas vid landning. */
  const [blocking, setBlocking] = useState<{
    seed: { staffId: string; startMinute: number } | null
    existing: CalendarBlock | null
  } | null>(() =>
    canManageBookings && calendarLaunchMode(params) === 'block'
      ? { seed: null, existing: null }
      : null,
  )
  const [mobileDateOpen, setMobileDateOpen] = useState(false)

  // router.refresh() levererar en ny bookings-array efter statusändring. Den öppna
  // drawern höll tidigare kvar objektet från före refresh och kunde därför visa
  // "Bekräftad" + aktiva knappar samtidigt som kortet redan var "Avbokad".
  useEffect(() => {
    setOpen((current) => {
      if (!current) return current
      return bookings.find((booking) => booking.id === current.id) ?? null
    })
  }, [bookings])

  useEffect(() => {
    if (!openBookingId) return
    setOpen(bookings.find((booking) => booking.id === openBookingId) ?? null)
  }, [bookings, openBookingId])

  const closeBooking = () => {
    setOpen(null)
    if (!params.has('open') && !params.has('absence')) return
    const sp = new URLSearchParams(params.toString())
    sp.delete('open')
    sp.delete('absence')
    const qs = sp.toString()
    router.replace(qs ? `/admin/bokningar?${qs}` : '/admin/bokningar', { scroll: false })
  }

  useEffect(() => {
    if (!mobileDateOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileDateOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileDateOpen])

  useEffect(() => {
    const toggleMobileDate = () => setMobileDateOpen((open) => !open)
    window.addEventListener(MOBILE_CALENDAR_DATE_EVENT, toggleMobileDate)
    return () => window.removeEventListener(MOBILE_CALENDAR_DATE_EVENT, toggleMobileDate)
  }, [])

  useEffect(() => {
    window.dispatchEvent(new Event('corevo:calendar-cancel-drag'))
  }, [date, view])

  // Djuplänk-parametrar (?ny/?blockera) är ENGÅNGS: rensa dem ur URL:en efter att
  // drawern öppnats, annars öppnar en omladdning/tillbaka-navigering den igen.
  useEffect(() => {
    const mode = calendarLaunchMode(params)
    if (!mode) return
    if (!canManageBookings) {
      setCreating(null)
      setBlocking(null)
    } else if (mode === 'new') {
      setBlocking(null)
      setCreating({ seed: null })
    } else {
      setCreating(null)
      setBlocking({ seed: null, existing: null })
    }
    const sp = new URLSearchParams(params.toString())
    sp.delete('ny')
    sp.delete('blockera')
    const qs = sp.toString()
    router.replace(qs ? `/admin/bokningar?${qs}` : '/admin/bokningar', { scroll: false })
  }, [canManageBookings, params, router])

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
  const staffNames = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff])

  const confirmMove = () => {
    if (!pendingMove) return
    const { booking, staffId, startIso } = pendingMove
    startMove(async () => {
      const res = await moveBooking({
        bookingId: booking.id,
        staffId,
        startIso,
        locationId: booking.locationId,
        serviceId: booking.serviceId,
        expectedStartIso: booking.startTs,
        expectedStaffId: booking.staffId,
      })
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
  const go = useCallback(
    (next: { vy?: CalendarView; datum?: string; resurs?: string }) => {
      const q = new URLSearchParams(params.toString())
      if (next.vy) q.set('vy', next.vy)
      if (next.datum) q.set('datum', next.datum)
      if (next.resurs !== undefined) {
        if (next.resurs) q.set('resurs', next.resurs)
        else q.delete('resurs')
      }
      q.delete('open')
      setMobileDateOpen(false)
      router.push(`/admin/bokningar?${q.toString()}`, { scroll: false })
    },
    [params, router],
  )

  // Resursfilter (B-06): fokusera EN person. Filtreringen sker här — samma data,
  // smalare blick — så filtret följer med gratis mellan dag/vecka/månad. Ett påhittat
  // ?resurs= som inte finns i rostern ignoreras tyst (= alla).
  const resurs = params.get('resurs') ?? ''
  const resursValid = staff.some((s) => s.id === resurs)
  const vStaff = resursValid ? staff.filter((s) => s.id === resurs) : staff
  const vBookings = resursValid ? bookings.filter((b) => b.staffId === resurs) : bookings
  const vBlocks = resursValid ? blocks.filter((b) => b.staffId === resurs) : blocks

  const visibleDaySlides = useMemo(() => {
    const filterDay = (day: CalendarDayData): CalendarDayData =>
      resursValid
        ? {
            ...day,
            staff: day.staff.filter((person) => person.id === resurs),
            bookings: day.bookings.filter((booking) => booking.staffId === resurs),
            blocks: day.blocks.filter((block) => block.staffId === resurs),
          }
        : day
    const previous = dayNeighbors?.previous ?? {
      date: addDays(date, -1),
      bookings: [],
      blocks: [],
      staff,
    }
    const next = dayNeighbors?.next ?? {
      date: addDays(date, 1),
      bookings: [],
      blocks: [],
      staff,
    }
    return [
      filterDay(previous),
      { date, bookings: vBookings, blocks: vBlocks, staff: vStaff },
      filterDay(next),
    ] as const
  }, [date, dayNeighbors, resurs, resursValid, staff, vBlocks, vBookings, vStaff])

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
      (sum, b) => sum + (new Date(b.endTs).getTime() - new Date(b.startTs).getTime()) / 60000,
      0,
    )
    const workedMin = vStaff.reduce((sum, s) => sum + s.workedMinutes, 0)
    const occupancy = occupancyPct(bookedMin, workedMin)
    return {
      week: isoWeekNumber(date),
      count: live.length,
      occupancy,
      cancelled,
    }
  }, [view, vBookings, vStaff, date])

  // Dagbladets tre slides delar den AKTUELLA dagens tidsaxel medan fingret drar.
  // Grannarnas längre öppettider får inte förlänga dagen med tomma timmar; när en
  // granne landar blir den mittendag och får sin egen riktiga axel.
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
  const pagerCenteredKey = useRef<string | null>(null)

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

  const mobilePeriodLabel = useMemo(() => {
    if (view === 'manad') return monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
    if (view === 'vecka') {
      const selected = new Date(`${date}T12:00:00Z`)
      const day = selected.getUTCDay()
      const monday = new Date(selected)
      monday.setUTCDate(selected.getUTCDate() + (day === 0 ? -6 : 1 - day))
      const sunday = new Date(monday)
      sunday.setUTCDate(monday.getUTCDate() + 6)
      const first = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', timeZone: tz }).format(
        monday,
      )
      const last = new Intl.DateTimeFormat('sv-SE', {
        day: 'numeric',
        month: 'long',
        timeZone: tz,
      }).format(sunday)
      return `${first}–${last}`
    }
    const selected = new Date(`${date}T12:00:00Z`)
    if (date === today) {
      const rest = new Intl.DateTimeFormat('sv-SE', {
        day: 'numeric',
        month: 'long',
        timeZone: tz,
      }).format(selected)
      return `Idag ${rest}`
    }
    return dayLabelLong.charAt(0).toUpperCase() + dayLabelLong.slice(1)
  }, [date, dayLabelLong, monthLabel, today, tz, view])

  const mobilePeriodStats = useMemo(() => {
    const periodBookings =
      view === 'manad'
        ? vBookings.filter((booking) => dayKey(booking.startTs, tz).startsWith(date.slice(0, 7)))
        : vBookings
    const live = periodBookings.filter((booking) => !isAvbokad(booking.status)).length
    const cancelled = periodBookings.filter((booking) => booking.status === 'cancelled').length
    const parts = [`${live} ${live === 1 ? 'bokning' : 'bokningar'}`]
    if (view === 'dag' && dayStats?.occupancy != null && dayStats.occupancy > 0) {
      parts.push(`${dayStats.occupancy}%`)
    }
    if (cancelled > 0) {
      parts.push(`${cancelled} avbokad${cancelled === 1 ? '' : 'e'}`)
    }
    const count = parts.join(' · ')
    const focusedName = resursValid ? staff.find((person) => person.id === resurs)?.name : null
    if (view === 'manad') return count
    return `v. ${isoWeekNumber(date)} · ${focusedName ? `${focusedName} · ` : ''}${count}`
  }, [date, dayStats?.occupancy, resurs, resursValid, staff, tz, vBookings, view])

  const mobileMonth = useMemo(() => {
    const anchor = new Date(`${date}T12:00:00Z`)
    const year = anchor.getUTCFullYear()
    const month = anchor.getUTCMonth()
    const first = new Date(Date.UTC(year, month, 1, 12))
    const leading = (first.getUTCDay() + 6) % 7
    const days = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate()
    const cells: Array<string | null> = Array.from({ length: leading }, () => null)
    for (let day = 1; day <= days; day += 1) {
      cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return {
      label: new Intl.DateTimeFormat('sv-SE', {
        month: 'long',
        year: 'numeric',
        timeZone: tz,
      }).format(anchor),
      cells,
    }
  }, [date, tz])

  const step = view === 'manad' ? 'month' : view === 'vecka' ? 'week' : 'day'
  const showToday = date !== today || view !== 'dag' || resursValid
  const shift = useCallback(
    (dir: -1 | 1) => {
      const target =
        step === 'month' ? addMonths(date, dir) : addDays(date, step === 'week' ? dir * 7 : dir)
      go({ datum: target })
    },
    [date, go, step],
  )

  const mobilePagerMatches = useCallback(
    () =>
      window.matchMedia('(max-width: 767px), (orientation: landscape) and (max-height: 520px)')
        .matches,
    [],
  )

  const settleDayPager = useCallback(() => {
    const scroller = scrollRef.current
    if (!scroller || view !== 'dag' || !mobilePagerMatches() || scroller.clientWidth <= 0) return
    const slide = nearestDaySlide(scroller.scrollLeft, scroller.clientWidth)
    setActiveDaySlide(slide)
    const landedDay = visibleDaySlides[slide]!.date
    setAnnouncedDay(landedDay)
    if (slide === 1 || pagerNavigationLocked.current) return
    // En ny dag börjar vid sitt arbetspass. Gör det samtidigt som landningen, inte
    // först när serverprops kommer 150–200 ms senare.
    scroller.scrollTop = 0
    pagerNavigationLocked.current = true
    setPagerNavigationPending(true)
    go({ datum: landedDay })
  }, [go, mobilePagerMatches, view, visibleDaySlides])

  const requestStep = useCallback(
    (dir: -1 | 1) => {
      if (step === 'month' || pagerNavigationLocked.current) return
      const scroller = scrollRef.current
      if (step !== 'day' || !scroller || !mobilePagerMatches()) {
        shift(dir)
        return
      }
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      scroller.scrollTop = 0
      scroller.scrollTo({
        left: scroller.clientWidth * (1 + dir),
        top: 0,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
      if (reducedMotion) settleDayPager()
    },
    [mobilePagerMatches, settleDayPager, shift, step],
  )

  // CSS Scroll Snap låter fingret följa ett sammanhängande tredagarsblad. URL:en
  // ändras först när bladet landat, aldrig mitt i halvpositionen.
  useLayoutEffect(() => {
    const scroller = scrollRef.current
    const pagerKey = `${view}:${date}`
    if (!scroller || view !== 'dag' || !mobilePagerMatches()) {
      pagerCenteredKey.current = null
      return
    }

    const shouldCenter = pagerCenteredKey.current !== pagerKey
    if (shouldCenter) {
      pagerCenteredKey.current = pagerKey
      scroller.scrollLeft = scroller.clientWidth
      pagerScrollLeft.current = scroller.clientWidth
      pagerNavigationLocked.current = false
      setPagerNavigationPending(false)
      setActiveDaySlide(1)
      setAnnouncedDay(date)
      scroller.scrollTop = 0
    }
  }, [date, mobilePagerMatches, view])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || view !== 'dag') return
    const hasNativeScrollEnd = 'onscrollend' in scroller
    const onScroll = () => {
      if (!mobilePagerMatches()) return
      const nextLeft = scroller.scrollLeft
      if (Math.abs(nextLeft - pagerScrollLeft.current) < 0.5) return
      pagerScrollLeft.current = nextLeft
      if (hasNativeScrollEnd) return
      if (pagerSettleTimer.current) clearTimeout(pagerSettleTimer.current)
      pagerSettleTimer.current = setTimeout(settleDayPager, 180)
    }
    const onScrollEnd = () => settleDayPager()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    if (hasNativeScrollEnd) scroller.addEventListener('scrollend', onScrollEnd)
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (hasNativeScrollEnd) scroller.removeEventListener('scrollend', onScrollEnd)
      if (pagerSettleTimer.current) clearTimeout(pagerSettleTimer.current)
    }
  }, [mobilePagerMatches, settleDayPager, view])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || view !== 'dag' || typeof ResizeObserver === 'undefined') return
    let width = scroller.clientWidth
    const observer = new ResizeObserver(() => {
      if (!mobilePagerMatches() || scroller.clientWidth === width) return
      width = scroller.clientWidth
      scroller.scrollLeft = width
      pagerScrollLeft.current = width
      setActiveDaySlide(1)
    })
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [mobilePagerMatches, view])

  useEffect(() => {
    const onShift = (event: Event) => {
      const direction = (event as CustomEvent<number>).detail
      if (direction === -1 || direction === 1) requestStep(direction)
    }
    window.addEventListener(MOBILE_CALENDAR_SHIFT_EVENT, onShift)
    return () => window.removeEventListener(MOBILE_CALENDAR_SHIFT_EVENT, onShift)
  }, [requestStep])

  useEffect(() => {
    const neighborLabel = (dir: -1 | 1) => {
      if (step === 'month') return '—'
      const target = addDays(date, step === 'day' ? dir : dir * 7)
      return new Intl.DateTimeFormat('sv-SE', {
        weekday: step === 'day' ? 'short' : undefined,
        day: 'numeric',
        month: 'short',
        timeZone: tz,
      }).format(new Date(`${target}T12:00:00Z`))
    }
    const publishMeta = () => {
      window.dispatchEvent(
        new CustomEvent(MOBILE_CALENDAR_META_EVENT, {
          detail: {
            title: mobilePeriodLabel,
            meta: mobilePeriodStats,
            previous: neighborLabel(-1),
            next: neighborLabel(1),
            step,
          },
        }),
      )
    }
    publishMeta()
    window.addEventListener(MOBILE_CALENDAR_META_REQUEST_EVENT, publishMeta)
    return () => window.removeEventListener(MOBILE_CALENDAR_META_REQUEST_EVENT, publishMeta)
  }, [date, mobilePeriodLabel, mobilePeriodStats, step, tz])

  const compactStepLabel = (dir: -1 | 1) => {
    if (step === 'month') return '—'
    const target = addDays(date, step === 'week' ? dir * 7 : dir)
    return new Intl.DateTimeFormat('sv-SE', {
      weekday: step === 'day' ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
      timeZone: tz,
    }).format(new Date(`${target}T12:00:00Z`))
  }
  const announcedDayLabel = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  }).format(new Date(`${announcedDay}T12:00:00Z`))

  // Klick på ledig yta = "boka här". Tiden SNAPPAS till 15 min (ett klick på 09:20-höjd
  // ger 09:15, aldrig 09:20) och resurs + tid ärvs in i drawern — användaren ska aldrig
  // mata in en kontext hen just pekade på.
  const onEmptyClick = (staffId: string, staffName: string, minute: number) => {
    if (!canManageBookings) return
    const snapped = Math.round(minute / SNAP_MIN) * SNAP_MIN
    // Väggklockan (snapped) → UTC-instant för salongens dag. Att räkna på lokal tid och
    // konvertera EN gång är det enda som håller över sommartidsskiftet.
    const startIso = wallClockToUtcIso(date, snapped, tz)
    setCreating({ seed: { staffId, staffName, startIso } })
  }

  /** Släpp av ett draget block. Skriver INTE direkt — en flytt är en handling kunden
   *  märker av, så den bekräftas först, med konsekvensen utskriven. */
  const onDropBooking = (booking: BookingRow, staffId: string, minute: number) => {
    if (!canManageBookings) return
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
      <div className={styles.mobileCalendarHeaderHelp}>
        <CalendarHelp mobileHeader>
          <CancelledLog tz={tz} label="Avbokade tider" embedded />
        </CalendarHelp>
      </div>

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
              className={`${styles.navSegToday}${date !== today ? ` ${styles.navSegTodayAway}` : ''}`}
              onClick={() => go({ datum: today })}
              aria-current={date === today ? 'date' : undefined}
              // Är man långt bort lyser knappen upp — den snabba vägen tillbaka till idag.
              title={date === today ? 'Idag' : 'Tillbaka till idag'}
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
          {canManageBookings && (
            <button
              type="button"
              className={`${styles.blockBtn} ${styles.mobileBlockBtn}`}
              onClick={() => setBlocking({ seed: null, existing: null })}
              aria-label="Blockera tid"
            >
              <Icon name="clock" size={14} />
            </button>
          )}
        </div>

        <div className={styles.toolbarRight}>
          {/* I dagvyn ÄR kolumnrubrikerna personalvalet. Vecka/månad saknar sådana
              rubriker, så desktop/iPad får ett enda kompakt val för att behålla
              filterfunktionen utan den dubbla chipraden. Mobilens toolbar är dold. */}
          {view !== 'dag' && staff.length > 1 && (
            <select
              className={styles.resSelect}
              value={resursValid ? resurs : ''}
              onChange={(event) => go({ resurs: event.target.value })}
              aria-label={`Filtrera på ${staffNoun.toLowerCase()}`}
            >
              <option value="">Alla {staff.length}</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
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
          {canManageBookings && (
            <button
              type="button"
              className={`${styles.blockBtn} ${styles.desktopBlockBtn}`}
              onClick={() => setBlocking({ seed: null, existing: null })}
            >
              <Icon name="clock" size={14} />
              <span>Blockera tid</span>
            </button>
          )}

          {/* Utan seed: drawern börjar på tjänstevalet och erbjuder dagens luckor.
              Med ett gridklick ärvs tid + resurs i stället. Två vägar in, EN yta. */}
          {canManageBookings && (
            <button
              type="button"
              className={styles.newBtn}
              onClick={() => setCreating({ seed: null })}
            >
              <Icon name="plus" size={15} />
              <span>Ny bokning</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollytan. overflow ligger HÄR, inte på sidan — därför scrollar aldrig
          dokumentet och toppnaven stannar kvar. */}
      <div
        ref={scrollRef}
        className={`${styles.scroll}${view === 'dag' ? ` ${styles.dayPager}` : ''}`}
        data-calendar-scroll
      >
        {view === 'dag' && (
          <div className={styles.dayTrack} data-calendar-day-track>
            {visibleDaySlides.map((day, index) => (
              <div
                key={day.date}
                className={`${styles.daySlide}${index !== 1 ? ` ${styles.daySlideAdjacent}` : ''}`}
                data-calendar-day-slide={day.date}
                inert={pagerNavigationPending || index !== activeDaySlide ? true : undefined}
                aria-hidden={pagerNavigationPending || index !== activeDaySlide ? true : undefined}
              >
                <DayGrid
                  bookings={day.bookings}
                  blocks={day.blocks}
                  staff={day.staff}
                  staffNoun={staffNoun}
                  tz={tz}
                  date={day.date}
                  today={today}
                  hours={hours}
                  dayStart={dayStart}
                  gridHeight={gridHeight}
                  onOpen={setOpen}
                  onEmptyClick={onEmptyClick}
                  onDropBooking={onDropBooking}
                  onOpenBlock={(block) => {
                    if (canManageBookings) setBlocking({ seed: null, existing: block })
                  }}
                  focusedStaffId={resursValid ? resurs : null}
                  onStaffToggle={(staffId) => go({ resurs: resurs === staffId ? '' : staffId })}
                  dragOver={index === 1 ? dragOver : null}
                  setDragOver={setDragOver}
                />
              </div>
            ))}
          </div>
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

      <p className={styles.calendarLive} aria-live="polite" aria-atomic="true">
        {announcedDayLabel}
      </p>

      <div className={styles.mobileCalendarDock}>
        <div className={styles.mobileCalendarDateRow}>
          <button
            type="button"
            className={styles.mobileDayStepButton}
            onClick={() => requestStep(-1)}
            aria-label={`Föregående: ${compactStepLabel(-1)}`}
            disabled={step === 'month'}
          >
            <Icon name="chevronLeft" size={15} />
            <span>{compactStepLabel(-1)}</span>
          </button>
          <button
            type="button"
            className={styles.mobileDateToggle}
            onClick={() => setMobileDateOpen((open) => !open)}
            aria-expanded={mobileDateOpen}
            aria-haspopup="dialog"
          >
            <span className={styles.mobileDateTitle}>
              {mobilePeriodLabel}
              <Icon name="chevronDown" size={12} />
            </span>
            <span className={`num ${styles.mobileDateStats}`}>{mobilePeriodStats}</span>
          </button>
          <button
            type="button"
            className={styles.mobileDayStepButton}
            onClick={() => requestStep(1)}
            aria-label={`Nästa: ${compactStepLabel(1)}`}
            disabled={step === 'month'}
          >
            <span>{compactStepLabel(1)}</span>
            <Icon name="chevronRight" size={15} />
          </button>
        </div>

        <div className={styles.mobileCalendarActionRow}>
          <button
            type="button"
            className={`${styles.mobileTodayBtn}${showToday ? '' : ` ${styles.mobileTodayIdle}`}`}
            onClick={() => go({ datum: today, vy: 'dag', resurs: '' })}
            aria-hidden={!showToday}
            tabIndex={showToday ? 0 : -1}
            disabled={!showToday}
          >
            Idag
          </button>
          <div className={styles.mobileViewSwitch} role="radiogroup" aria-label="Kalendervy">
            {VIEWS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={view === item.value}
                className={view === item.value ? styles.mobileViewOn : undefined}
                onClick={() => go({ vy: item.value })}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.mobileBlockAction}
            onClick={() => setBlocking({ seed: null, existing: null })}
          >
            <Icon name="clock" size={13} />
            Blockera
          </button>
          {/* Sök BOR i verktygsraden (Zivar 2026-07-18: "sökdelen syns inte") — den
              gamla flytande knappen låg fixed bakom bottennavens täckande yta. */}
          <CalendarSearch tz={tz} mobileSheet />
        </div>
      </div>

      {mobileDateOpen && (
        <>
          <button
            type="button"
            className={styles.mobileCalendarScrim}
            onClick={() => setMobileDateOpen(false)}
            aria-label="Stäng datumväljaren"
          />
          <div
            className={styles.mobileCalendarPicker}
            role="dialog"
            aria-modal="true"
            aria-label="Välj datum"
          >
            <div className={styles.mobilePickerHead}>
              <strong>
                {mobileMonth.label.charAt(0).toUpperCase() + mobileMonth.label.slice(1)}
              </strong>
              <span className="num">Välj en dag</span>
            </div>
            <div className={styles.mobilePickerWeekdays} aria-hidden="true">
              {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((dayName, index) => (
                <span key={`${dayName}-${index}`}>{dayName}</span>
              ))}
            </div>
            <div className={styles.mobilePickerDays}>
              {mobileMonth.cells.map((cell, index) =>
                cell ? (
                  <button
                    key={cell}
                    type="button"
                    className={`${cell === date ? ` ${styles.mobilePickerSelected}` : ''}${cell === today ? ` ${styles.mobilePickerToday}` : ''}`}
                    onClick={() => go({ datum: cell, vy: 'dag' })}
                    aria-current={cell === date ? 'date' : undefined}
                  >
                    {Number(cell.slice(-2))}
                  </button>
                ) : (
                  <span key={`blank-${index}`} />
                ),
              )}
            </div>
          </div>
        </>
      )}

      {open && (
        <BookingDrawer
          booking={open}
          tz={tz}
          staffNoun={staffNoun}
          staffColor={colorOf(open.staffId)}
          staff={eligibleRescheduleStaff(staff, open.serviceId, open.locationId)}
          onlinePaymentsActive={onlinePaymentsActive}
          canManage={canManageBookings}
          absenceTimeOffId={absenceTimeOffId}
          onClose={closeBooking}
        />
      )}

      {canManageBookings && creating && (
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

      {canManageBookings && blocking && (
        <BlockDrawer
          staff={staff}
          date={date}
          tz={tz}
          locationId={locationId}
          seed={blocking.seed}
          existing={blocking.existing}
          onClose={() => setBlocking(null)}
        />
      )}

      {/* Flytt-bekräftelse. Texten beskriver KONSEKVENSEN — vem, från vad, till vad —
          aldrig ett innehållslöst "Är du säker?". Wavys copy-mönster, för det är det
          enda som gör att man vågar dra utan att tveka. */}
      {canManageBookings && pendingMove && (
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
  return (
    <div
      className={styles.nowLine}
      style={{ top: top + offset }}
      data-calendar-now
      aria-hidden="true"
    />
  )
}

/** Håll-tid innan en tryckning på tom yta räknas som "jag vill boka HÄR". */
const HOLD_MS = 320
/** Rör fingret sig mer än så är det en scroll, inte en tryckning. */
const SLOP_PX = 10

type FreeAreaGestureCoordinator = {
  cancelActive: (() => void) | null
}

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
 * TANGENTBORD: Enter/Space på knappen fungerar som förut (öppnar mitt i ytan).
 */
function FreeArea({
  staffName,
  onPick,
  gestureCoordinator,
}: {
  staffName: string
  onPick: (clientY: number, box: DOMRect) => void
  gestureCoordinator: FreeAreaGestureCoordinator
}) {
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)

  const cancel = useCallback(() => {
    if (hold.current) clearTimeout(hold.current.timer)
    hold.current = null
    if (gestureCoordinator.cancelActive === cancel) gestureCoordinator.cancelActive = null
  }, [gestureCoordinator])

  useEffect(() => cancel, [cancel])

  return (
    <button
      type="button"
      className={styles.freeArea}
      aria-label={`Boka ledig tid hos ${staffName}`}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return // musen går på onClick
        if (!e.isPrimary) {
          // Koordinatorn delas av alla personalkolumner. Finger två kan landa i en
          // annan FreeArea-instans än finger ett och måste ändå avbryta den
          // redan armerade långtryckstimern.
          gestureCoordinator.cancelActive?.()
          return
        }
        gestureCoordinator.cancelActive?.()
        gestureCoordinator.cancelActive = cancel
        const el = e.currentTarget
        const { clientX: x, clientY: y } = e
        hold.current = {
          x,
          y,
          timer: setTimeout(() => {
            hold.current = null
            if (gestureCoordinator.cancelActive === cancel) {
              gestureCoordinator.cancelActive = null
            }
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

type BookingDragPointer = {
  clientX: number
  clientY: number
  grabOffsetX: number
  grabOffsetY: number
}

type BookingDragSession = {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  grabOffsetX: number
  grabOffsetY: number
  originLeft: number
  originTop: number
  width: number
  height: number
  active: boolean
  moved: boolean
  touch: boolean
  timer: number | null
  frame: number | null
  lastFrameAt: number | null
  target: HTMLButtonElement
  scrollContainer: HTMLElement | null
  cancelGlobalBlock: (() => void) | null
}

function BookingBlock({
  booking,
  tz,
  top,
  height,
  lane,
  lanes,
  onOpen,
  movable,
  onPointerPreview,
  onPointerDrop,
  onPointerAbort,
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
  /** goal-67: den bokade personens färg (hex). Bär "vems tid är det?" — den fråga
   *  en full dag ställer oftast. Aldrig ensam bärare: initialerna står i kortet och
   *  status har fortfarande ikon + text. */
  color: string
  /** Avbokade tider går inte att flytta — och veckovyn saknar resurskolumner att
   *  släppa i, så dragning är avstängd där. */
  movable?: boolean
  onPointerPreview?: (booking: BookingRow, pointer: BookingDragPointer) => void
  onPointerDrop?: (booking: BookingRow, pointer: BookingDragPointer) => boolean
  onPointerAbort?: () => void
  /** Dagvyn: blocken är breda nog för kundens telefonnummer. I vecko-/månadsvyn
   *  finns inte pixlarna — och där jobbar man inte heller "ring nästa kund". */
  showPhone?: boolean
}) {
  const dim = isAvbokad(booking.status)
  const name = booking.customerName?.trim() || 'Gäst'
  const bookingButtonRef = useRef<HTMLButtonElement>(null)
  const pointerDrag = useRef<BookingDragSession | null>(null)
  const suppressClick = useRef(false)
  const suppressClickTimer = useRef<number | null>(null)
  const rollbackTimer = useRef<number | null>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const [touchDragging, setTouchDragging] = useState(false)
  const [ghost, setGhost] = useState<{
    width: number
    height: number
    left: number
    top: number
  } | null>(null)

  const suppressSyntheticClick = () => {
    suppressClick.current = true
    if (suppressClickTimer.current != null) window.clearTimeout(suppressClickTimer.current)
    suppressClickTimer.current = window.setTimeout(() => {
      suppressClick.current = false
      suppressClickTimer.current = null
    }, 350)
  }

  const releaseCapture = (drag: BookingDragSession) => {
    if (drag.target.hasPointerCapture(drag.pointerId)) {
      drag.target.releasePointerCapture(drag.pointerId)
    }
  }

  const clearSessionResources = (drag: BookingDragSession) => {
    if (drag.timer != null) window.clearTimeout(drag.timer)
    if (drag.frame != null) window.cancelAnimationFrame(drag.frame)
    drag.cancelGlobalBlock?.()
    drag.timer = null
    drag.frame = null
    drag.cancelGlobalBlock = null
  }

  const clearDragVisual = () => {
    if (rollbackTimer.current != null) window.clearTimeout(rollbackTimer.current)
    rollbackTimer.current = null
    setTouchDragging(false)
    setGhost(null)
  }

  const rollbackDragVisual = (drag: BookingDragSession) => {
    const node = ghostRef.current
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!node || reducedMotion) {
      clearDragVisual()
      return
    }
    if (styles.blockGhostRollback) node.classList.add(styles.blockGhostRollback)
    node.style.transform = `translate3d(${drag.originLeft}px, ${drag.originTop}px, 0)`
    rollbackTimer.current = window.setTimeout(clearDragVisual, 200)
  }

  const dragPointer = (drag: BookingDragSession): BookingDragPointer => ({
    clientX: drag.lastX,
    clientY: drag.lastY,
    grabOffsetX: drag.grabOffsetX,
    grabOffsetY: drag.grabOffsetY,
  })

  const scheduleDragFrame = (drag: BookingDragSession) => {
    if (drag.frame != null || pointerDrag.current !== drag) return
    drag.frame = window.requestAnimationFrame((timestamp) => {
      drag.frame = null
      if (pointerDrag.current !== drag || !drag.active) return

      const position = dragGhostPosition(drag.lastX, drag.lastY, drag.grabOffsetX, drag.grabOffsetY)
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate3d(${position.left}px, ${position.top}px, 0)`
      }

      let keepAutoScrolling = false
      const scroller = drag.scrollContainer
      if (scroller) {
        const rect = scroller.getBoundingClientRect()
        const velocity = edgeAutoScrollVelocity(drag.lastY, rect.top, rect.bottom)
        if (velocity !== 0) {
          const elapsed = drag.lastFrameAt == null ? 16 : Math.min(32, timestamp - drag.lastFrameAt)
          const before = scroller.scrollTop
          scroller.scrollTop += (velocity * elapsed) / 1000
          keepAutoScrolling = Math.abs(scroller.scrollTop - before) > 0.1
          drag.lastFrameAt = timestamp
        } else {
          drag.lastFrameAt = null
        }
      }

      // Efter eventuell kant-scroll räknas kolumn + 15-minutersslot om. DayGrid
      // uppdaterar React-state bara när just personal eller slot faktiskt ändrats.
      onPointerPreview?.(booking, dragPointer(drag))
      if (keepAutoScrolling) scheduleDragFrame(drag)
    })
  }

  const liftDrag = (drag: BookingDragSession) => {
    if (pointerDrag.current !== drag || drag.active) return
    drag.active = true
    if (drag.timer != null) window.clearTimeout(drag.timer)
    drag.timer = null
    setTouchDragging(true)
    setGhost({
      width: drag.width,
      height: drag.height,
      left: drag.originLeft,
      top: drag.originTop,
    })
    scheduleDragFrame(drag)
  }

  const abortDrag = (drag: BookingDragSession, rollback = true) => {
    if (pointerDrag.current !== drag) return
    pointerDrag.current = null
    clearSessionResources(drag)
    releaseCapture(drag)
    // En avbruten pointersekvens (OS-gest, extra finger, rotation eller navigation)
    // får inte falla igenom som ett syntetiskt klick och öppna bokningen.
    suppressSyntheticClick()
    if (drag.active) {
      onPointerAbort?.()
      if (rollback) rollbackDragVisual(drag)
      else clearDragVisual()
    } else {
      clearDragVisual()
    }
  }

  /** Rörelse före långtrycket låser gesten till vanlig scroll. Den får aldrig senare
   * byta identitet och plötsligt bli ett bokningsdrag. */
  const cancelPressCandidate = (drag: BookingDragSession) => {
    if (pointerDrag.current !== drag) return
    pointerDrag.current = null
    clearSessionResources(drag)
    releaseCapture(drag)
    suppressSyntheticClick()
    clearDragVisual()
  }

  // Listenern måste finnas redan när touchsekvensen börjar. Chromium bestämmer
  // annars att scrollmotorn äger gesten och skickar pointercancel så fort den
  // redan lyfta ghosten börjar röra sig. Före lyftet blockeras ingenting.
  useEffect(() => {
    const target = bookingButtonRef.current
    if (!target) return
    const blockActiveTouchScroll = (event: TouchEvent) => {
      if (pointerDrag.current?.active) event.preventDefault()
    }
    target.addEventListener('touchmove', blockActiveTouchScroll, { passive: false })
    return () => target.removeEventListener('touchmove', blockActiveTouchScroll)
  }, [])

  useEffect(
    () => () => {
      const drag = pointerDrag.current
      pointerDrag.current = null
      if (drag) clearSessionResources(drag)
      if (suppressClickTimer.current != null) window.clearTimeout(suppressClickTimer.current)
      if (rollbackTimer.current != null) window.clearTimeout(rollbackTimer.current)
    },
    [],
  )

  // Ett block är bara så högt som tiden är lång — texten måste anpassa sig, inte
  // klippas mitt i en rad.
  //
  // v2 (Zivar 2026-07-18: "jag kan inte se vad de bokat utan att klicka"): tid och
  // namn delar EN rad (.blockHead) — det frigör en hel radhöjd, så TJÄNSTEN ryms
  // redan i ett 30-minutersblock (42px vid PX_PER_MIN 1.4). Nivåerna, räknade ur
  // radhöjderna med paddingen (10px) avdragen:
  //   ≥ 56px  full    tid·namn + tjänst + telefon   (15.6+14.4+13.2+gap ≈ 45 + 10)
  //   ≥ 42px  medium  tid·namn + tjänst             (≈ 31 + 10)  ← 30-min-tiden
  //   < 42px  tiny    EN rad: tid och namn
  //
  // Statusflaggan tar INGEN höjd — den ligger absolut i kortets hörn (.blockFlag).
  // Telefonnumret visas från 45-min-block (63px ≥ 56); i mindre block är det ETT
  // klick bort i drawern. Allt finns alltid i title, aria-label och drawern.
  const h = Math.max(height, 20)
  const tier = h >= 56 ? 'full' : h >= 42 ? 'medium' : 'tiny'
  const showService = tier !== 'tiny'
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

  const renderContent = () => (
    <>
      <span className={styles.blockHead}>
        <span className={`num ${styles.blockTime}`}>{timeLabel(booking.startTs, tz)}</span>
        <span className={styles.blockName}>{name}</span>
      </span>
      {showService && <span className={styles.blockService}>{booking.serviceName}</span>}
      <span className={`num ${styles.blockEnd}`}>{timeLabel(booking.endTs, tz)}</span>
      {tier === 'full' && phone && (
        <span className={`num ${styles.blockPhone}`}>
          <Icon name="phone" size={10} />
          {phone}
        </span>
      )}
      {statusFlag && (
        <span
          className={`${styles.blockFlag}${tier === 'full' ? ` ${styles.blockFlagFull}` : ''}`}
          title={statusFlag.text}
        >
          <Icon name={statusFlag.icon} size={11} />
          {tier === 'full' && <span>{statusFlag.text}</span>}
        </span>
      )}
      {!showPhone && tier !== 'tiny' && (
        <span className={styles.blockWho} style={{ background: color }}>
          {staffInitials(booking.staffTitle)}
        </span>
      )}
    </>
  )

  return (
    <>
      <button
        ref={bookingButtonRef}
        type="button"
        className={`${styles.block}${dim ? ` ${styles.blockDim}` : ''}${movable ? ` ${styles.blockDrag}` : ''}${touchDragging ? ` ${styles.blockTouchDragging}` : ''}${tier === 'tiny' ? ` ${styles.blockTiny}` : ''}`}
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
        data-calendar-booking
        onPointerDown={(e) => {
          const fromTouch = e.pointerType === 'touch' || e.pointerType === 'pen'
          const fromDesktopMouse =
            e.pointerType === 'mouse' &&
            e.button === 0 &&
            window.matchMedia('(min-width: 768px) and (pointer: fine)').matches
          if (!movable || !e.isPrimary || (!fromDesktopMouse && !fromTouch)) return
          const target = e.currentTarget
          const rect = target.getBoundingClientRect()
          const drag: BookingDragSession = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            grabOffsetX: e.clientX - rect.left,
            grabOffsetY: e.clientY - rect.top,
            originLeft: rect.left,
            originTop: rect.top,
            width: rect.width,
            height: rect.height,
            active: false,
            moved: false,
            touch: fromTouch,
            timer: null,
            frame: null,
            lastFrameAt: null,
            target,
            scrollContainer: target.closest<HTMLElement>('[data-calendar-scroll]'),
            cancelGlobalBlock: null,
          }
          pointerDrag.current = drag
          target.setPointerCapture(e.pointerId)
          const cancelForExternalState = (event?: Event) => {
            if (event instanceof PointerEvent && event.pointerId === drag.pointerId) return
            if (event?.type === 'visibilitychange' && document.visibilityState === 'visible') return
            abortDrag(drag)
          }
          window.addEventListener('pointerdown', cancelForExternalState, true)
          window.addEventListener('resize', cancelForExternalState)
          window.addEventListener('pagehide', cancelForExternalState)
          window.addEventListener('corevo:calendar-cancel-drag', cancelForExternalState)
          document.addEventListener('visibilitychange', cancelForExternalState)
          drag.cancelGlobalBlock = () => {
            window.removeEventListener('pointerdown', cancelForExternalState, true)
            window.removeEventListener('resize', cancelForExternalState)
            window.removeEventListener('pagehide', cancelForExternalState)
            window.removeEventListener('corevo:calendar-cancel-drag', cancelForExternalState)
            document.removeEventListener('visibilitychange', cancelForExternalState)
          }
          if (fromTouch) {
            drag.timer = window.setTimeout(() => {
              liftDrag(drag)
            }, TOUCH_DRAG_HOLD_MS)
          }
        }}
        onPointerMove={(e) => {
          const drag = pointerDrag.current
          if (!drag || drag.pointerId !== e.pointerId) return
          drag.lastX = e.clientX
          drag.lastY = e.clientY
          const distance = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY)
          if (drag.touch && !drag.active) {
            if (distance > TOUCH_DRAG_SLOP_PX) cancelPressCandidate(drag)
            return
          }
          if (!drag.active && distance <= TOUCH_DRAG_SLOP_PX) return
          if (!drag.active) liftDrag(drag)
          if (distance < 1) return
          drag.moved = true
          if (drag.touch) e.preventDefault()
          scheduleDragFrame(drag)
        }}
        onPointerUp={(e) => {
          const drag = pointerDrag.current
          if (!drag || drag.pointerId !== e.pointerId) return
          pointerDrag.current = null
          drag.lastX = e.clientX
          drag.lastY = e.clientY
          clearSessionResources(drag)
          releaseCapture(drag)
          if (!drag.active) return
          suppressSyntheticClick()
          if (!drag.moved) {
            rollbackDragVisual(drag)
            onPointerAbort?.()
            return
          }
          const valid = onPointerDrop?.(booking, dragPointer(drag)) ?? false
          if (valid) clearDragVisual()
          else rollbackDragVisual(drag)
        }}
        onPointerCancel={(e) => {
          const drag = pointerDrag.current
          if (!drag || drag.pointerId !== e.pointerId) return
          abortDrag(drag)
        }}
        onLostPointerCapture={(e) => {
          const drag = pointerDrag.current
          if (drag?.pointerId !== e.pointerId) return
          abortDrag(drag)
        }}
        onClick={() => {
          if (suppressClick.current) return
          onOpen(booking)
        }}
        title={`${timeLabel(booking.startTs, tz)}–${timeLabel(booking.endTs, tz)} · ${name} · ${booking.serviceName}`}
        aria-label={`${timeLabel(booking.startTs, tz)}–${timeLabel(booking.endTs, tz)} ${name}, ${booking.serviceName}, ${booking.staffTitle}${statusFlag ? `, ${statusFlag.text}` : ''}`}
      >
        {renderContent()}
      </button>
      {ghost && (
        <div
          ref={ghostRef}
          className={`${styles.block} ${styles.blockGhost}${dim ? ` ${styles.blockDim}` : ''}${tier === 'tiny' ? ` ${styles.blockTiny}` : ''}`}
          style={{
            width: ghost.width,
            height: ghost.height,
            transform: `translate3d(${ghost.left}px, ${ghost.top}px, 0)`,
            ['--bk' as string]: color,
            ['--bk-status' as string]: statusAccent(booking.status),
          }}
          aria-hidden="true"
        >
          {renderContent()}
        </div>
      )}
    </>
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
  onEmptyClick,
  onDropBooking,
  onOpenBlock,
  focusedStaffId,
  onStaffToggle,
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
  onEmptyClick: (staffId: string, staffName: string, minute: number) => void
  onDropBooking: (booking: BookingRow, staffId: string, minute: number) => void
  onOpenBlock: (block: CalendarBlock) => void
  focusedStaffId: string | null
  onStaffToggle: (staffId: string) => void
  dragOver: { staffId: string; minute: number; durationMin: number } | null
  setDragOver: (v: { staffId: string; minute: number; durationMin: number } | null) => void
}) {
  const freeAreaGesture = useRef<FreeAreaGestureCoordinator>({ cancelActive: null })

  if (staff.length === 0) {
    return (
      <p className={styles.empty}>
        Ingen {staffNoun.toLowerCase()} upplagd ännu. Lägg till {staffNoun.toLowerCase()} under
        Inställningar, så får kalendern sina kolumner.
      </p>
    )
  }

  const pointerTarget = (pointer: BookingDragPointer) => {
    const target = document
      .elementFromPoint(pointer.clientX, pointer.clientY)
      ?.closest<HTMLElement>('[data-calendar-staff-id]')
    if (!target) return null
    const staffId = target.dataset.calendarStaffId
    if (!staffId || !staff.some((person) => person.id === staffId)) return null
    const box = target.getBoundingClientRect()
    return {
      staffId,
      minute: dayStart + (pointer.clientY - pointer.grabOffsetY - box.top) / PX_PER_MIN,
    }
  }

  const previewPointerMove = (booking: BookingRow, pointer: BookingDragPointer) => {
    const target = pointerTarget(pointer)
    if (!target) {
      setDragOver(null)
      return
    }
    const minute = Math.round(target.minute / SNAP_MIN) * SNAP_MIN
    const durationMin = minutesInTz(booking.endTs, tz) - minutesInTz(booking.startTs, tz)
    const dayEnd = dayStart + gridHeight / PX_PER_MIN
    if (minute < dayStart || minute + durationMin > dayEnd) {
      setDragOver(null)
      return
    }
    if (
      dragOver?.staffId !== target.staffId ||
      dragOver.minute !== minute ||
      dragOver.durationMin !== durationMin
    ) {
      setDragOver({ staffId: target.staffId, minute, durationMin })
    }
  }

  const finishPointerMove = (booking: BookingRow, pointer: BookingDragPointer) => {
    const target = pointerTarget(pointer)
    setDragOver(null)
    if (!target) return false
    const minute = Math.round(target.minute / SNAP_MIN) * SNAP_MIN
    const durationMin = minutesInTz(booking.endTs, tz) - minutesInTz(booking.startTs, tz)
    const dayEnd = dayStart + gridHeight / PX_PER_MIN
    if (minute < dayStart || minute + durationMin > dayEnd) return false
    onDropBooking(booking, target.staffId, minute)
    return true
  }

  return (
    <div
      className={styles.dayWrap}
      style={{ ['--cols' as string]: staff.length }}
      onPointerDownCapture={(event) => {
        // Capture-nivån omfattar fri yta, bokningskort och blockeringar. Ett andra
        // finger avbryter därför alltid den eventuella friytetimern, oavsett vilket
        // syskonelement det landar ovanpå.
        if (!event.isPrimary) freeAreaGesture.current.cancelActive?.()
      }}
    >
      {/* Resurshuvudena är sticky: scrollar man ner i dagen ser man fortfarande vems
          kolumn man tittar i. */}
      <div className={styles.head}>
        <div className={styles.headSpacer} />
        {staff.map((s) => {
          // "N idag" = personens LEVANDE bokningar (avbokat/uteblivet räknas inte som
          // dagens arbete). Samma sanning som lastsiffran i designens kolumnhuvud.
          const load = bookings.filter((b) => b.staffId === s.id && !isAvbokad(b.status)).length
          return (
            <button
              key={s.id}
              type="button"
              className={`${styles.headCell} ${styles.headCellDay} ${styles.headCellBtn}`}
              // 2px färglinje under huvudet (designens box-shadow) — färgen förstärker
              // kolumnidentiteten men bärs aldrig ensam: namn + avatar-initialer står kvar.
              style={{ ['--bk' as string]: s.color }}
              onClick={() => onStaffToggle(s.id)}
              aria-pressed={focusedStaffId === s.id}
              aria-label={
                focusedStaffId === s.id
                  ? `Visa alla ${staffNoun.toLowerCase()}`
                  : `Visa bara ${s.name}`
              }
            >
              <span className={styles.headAvatar} aria-hidden="true">
                {(s.name.trim()[0] ?? '?').toUpperCase()}
              </span>
              <span className={styles.headText}>
                <span className={styles.headName}>{s.name}</span>
                <span className={`num ${styles.headHours}`}>
                  {s.start && s.end ? `${s.start.slice(0, 5)}–${s.end.slice(0, 5)}` : 'Ledig'}
                </span>
                {focusedStaffId === s.id && (
                  <span className={styles.headFocusHint}>× Visa alla</span>
                )}
              </span>
              <span className={`num ${styles.headLoad}`}>{load} idag</span>
            </button>
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
            <div key={s.id} className={styles.col} data-calendar-staff-id={s.id}>
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
                gestureCoordinator={freeAreaGesture.current}
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
                    height={(minutesInTz(bl.endTs, tz) - minutesInTz(bl.startTs, tz)) * PX_PER_MIN}
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
                  movable={isBokad(booking.status)}
                  onPointerPreview={previewPointerMove}
                  onPointerDrop={finishPointerMove}
                  onPointerAbort={() => setDragOver(null)}
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
                  <MonthBooking
                    key={b.id}
                    booking={b}
                    tz={tz}
                    color={colorOf(b.staffId)}
                    onOpen={onOpen}
                  />
                ))}
                {rest > 0 && (
                  <button
                    type="button"
                    className={styles.monthMore}
                    onClick={() => onDayClick(key)}
                  >
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
