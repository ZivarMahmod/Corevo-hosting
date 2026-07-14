'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { moveBooking } from '@/lib/admin/calendar-actions'
import { Button, Icon, Modal, useToast } from '@/components/portal/ui'
import {
  BookingDrawer,
  dayKey,
  isAvbokad,
  isKlar,
  statusAccent,
  timeLabel,
  type BookingRow,
} from './BookingDrawer'
import {
  NewBookingDrawer,
  type CalendarService,
  type NewBookingSeed,
} from './NewBookingDrawer'
import { BlockDrawer } from './BlockDrawer'
import { CalendarHelp } from './CalendarHelp'
import { CancelledLog } from './CancelledLog'
import { CalendarSearch } from './CalendarSearch'
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
  /** null = stängd. Ett objekt (ev. med seed) = skapa-läge. */
  const [creating, setCreating] = useState<{ seed: NewBookingSeed | null } | null>(null)
  /** Blockera tid: ny (seed från gridklick eller tom) eller befintlig (öppnad blockering). */
  const [blocking, setBlocking] = useState<{
    seed: { staffId: string; startMinute: number } | null
    existing: CalendarBlock | null
  } | null>(null)

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
      const res = await moveBooking({ bookingId: booking.id, staffId, startIso })
      if (res.error) notify(res.error, 'warning')
      else {
        notify(res.success ?? 'Bokningen är flyttad.', 'success')
        router.refresh()
      }
      setPendingMove(null)
    })
  }

  // Navigering bor i URL:en. Vy och datum är delbara och bakåtknappen fungerar.
  const go = (next: { vy?: CalendarView; datum?: string }) => {
    const q = new URLSearchParams(params.toString())
    if (next.vy) q.set('vy', next.vy)
    if (next.datum) q.set('datum', next.datum)
    q.delete('open')
    router.push(`/admin/bokningar?${q.toString()}`)
  }

  // Arbetsdagens fönster = union av resursernas arbetstider. Tom dag (ingen arbetar)
  // faller tillbaka på 08–18 så rutnätet aldrig kollapsar till en tom remsa.
  const [dayStart, dayEnd] = useMemo(() => {
    const starts = staff.filter((s) => s.start).map((s) => toMin(s.start!))
    const ends = staff.filter((s) => s.end).map((s) => toMin(s.end!))
    // Bokningar utanför arbetstid (t.ex. inlagda före ett schemabyte) måste ändå SYNAS.
    for (const b of bookings) {
      starts.push(minutesInTz(b.startTs, tz))
      ends.push(minutesInTz(b.endTs, tz))
    }
    if (starts.length === 0) return [8 * 60, 18 * 60]
    const lo = Math.floor(Math.min(...starts) / 60) * 60
    const hi = Math.ceil(Math.max(...ends) / 60) * 60
    return [lo, Math.max(hi, lo + 60)]
  }, [staff, bookings, tz])

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
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => shift(-1)}
            aria-label="Föregående"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <button
            type="button"
            className={styles.todayBtn}
            onClick={() => go({ datum: today })}
            aria-current={date === today ? 'date' : undefined}
          >
            Idag
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => shift(1)}
            aria-label="Nästa"
          >
            <Icon name="chevronRight" size={16} />
          </button>
          <h2 className={styles.periodLabel}>
            {view === 'manad' ? monthLabel : dayLabelLong}
          </h2>
        </div>

        <div className={styles.toolbarRight}>
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
            bookings={bookings}
            blocks={blocks}
            staff={staff}
            tz={tz}
            date={date}
            today={today}
            hours={hours}
            dayStart={dayStart}
            gridHeight={gridHeight}
            onOpen={setOpen}
            onEmptyClick={onEmptyClick}
            onDropBooking={onDropBooking}
            onOpenBlock={(block) => setBlocking({ seed: null, existing: block })}
            dragOver={dragOver}
            setDragOver={setDragOver}
          />
        )}
        {view === 'vecka' && (
          <WeekGrid
            bookings={bookings}
            tz={tz}
            date={date}
            today={today}
            hours={hours}
            dayStart={dayStart}
            gridHeight={gridHeight}
            onOpen={setOpen}
            onDayClick={(d) => go({ vy: 'dag', datum: d })}
          />
        )}
        {view === 'manad' && (
          <MonthGrid
            bookings={bookings}
            tz={tz}
            date={date}
            today={today}
            onDayClick={(d) => go({ vy: 'dag', datum: d })}
          />
        )}
      </div>

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

function BookingBlock({
  booking,
  tz,
  top,
  height,
  lane,
  lanes,
  onOpen,
  draggable,
  showPhone,
}: {
  booking: BookingRow
  tz: string
  top: number
  height: number
  lane: number
  lanes: number
  onOpen: (b: BookingRow) => void
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
  // klippas mitt i en rad. Tre nivåer, styrda av verklig höjd:
  //   ≥ 56px  allt (tid · kund · tjänst · telefon · statusflagga)
  //   ≥ 34px  tid · kund · tjänst — TJÄNSTEN överlever hit ner med flit: "vilken
  //           klippning?" är den fråga receptionen ställer oftast, och en 30-min-tid
  //           (42px) är exakt den bokning man annars hade behövt öppna för att se det
  //   < 34px  EN rad: tid och kund sida vid sida
  // Statusen finns alltid kvar i accentkanten + i drawern; det är texten som viker,
  // aldrig informationen.
  const h = Math.max(height, 20)
  const tier = h >= 56 ? 'full' : h >= 34 ? 'medium' : 'tiny'
  // Avbokad tid → inget nummer. Att ringa någon som redan avbokat är precis det
  // misstag ett synligt nummer inbjuder till.
  const phone = showPhone && !dim ? booking.customerPhone : null
  const statusFlag =
    booking.status === 'pending'
      ? { icon: 'alert' as const, text: 'Obekräftad' }
      : isKlar(booking.status)
        ? { icon: 'check' as const, text: 'Klar' }
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
        borderLeftColor: statusAccent(booking.status),
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
      onClick={() => onOpen(booking)}
      title={`${timeLabel(booking.startTs, tz)}–${timeLabel(booking.endTs, tz)} · ${name} · ${booking.serviceName}`}
      aria-label={`${timeLabel(booking.startTs, tz)}–${timeLabel(booking.endTs, tz)} ${name}, ${booking.serviceName}, ${booking.staffTitle}${statusFlag ? `, ${statusFlag.text}` : ''}`}
    >
      <span className={`num ${styles.blockTime}`}>{timeLabel(booking.startTs, tz)}</span>
      <span className={styles.blockName}>{name}</span>
      {tier !== 'tiny' && <span className={styles.blockService}>{booking.serviceName}</span>}
      {/* Numret står som TEXT här, inte som länk: blocket är redan en <button>, och en
          <a> inuti en <button> är ogiltig HTML som skärmläsare tolkar olika. Ringbart
          blir det i dialogen — ett klick bort, precis som önskat. */}
      {tier === 'full' && phone && (
        <span className={`num ${styles.blockPhone}`}>
          <Icon name="phone" size={10} />
          {phone}
        </span>
      )}
      {/* Status bärs av ikon + text, aldrig av färgen ensam (färgblinda + gråskala).
          I ett litet block räcker ikonen — texten skulle ändå inte få plats. */}
      {statusFlag && tier !== 'tiny' && (
        <span className={styles.blockFlag}>
          <Icon name={statusFlag.icon} size={11} />
          {tier === 'full' && <span>{statusFlag.text}</span>}
        </span>
      )}
      {statusFlag && tier === 'tiny' && (
        <span className={styles.blockFlagTiny} aria-hidden="true">
          <Icon name={statusFlag.icon} size={11} />
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
  dragOver,
  setDragOver,
}: {
  bookings: BookingRow[]
  blocks: CalendarBlock[]
  staff: CalendarStaff[]
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
  dragOver: { staffId: string; minute: number; durationMin: number } | null
  setDragOver: (v: { staffId: string; minute: number; durationMin: number } | null) => void
}) {
  if (staff.length === 0) {
    return (
      <p className={styles.empty}>
        Ingen personal upplagd ännu. Lägg till medarbetare under Inställningar, så får kalendern
        sina kolumner.
      </p>
    )
  }

  return (
    <div className={styles.dayWrap} style={{ ['--cols' as string]: staff.length }}>
      {/* Resurshuvudena är sticky: scrollar man ner i dagen ser man fortfarande vems
          kolumn man tittar i. */}
      <div className={styles.head}>
        <div className={styles.headSpacer} />
        {staff.map((s) => (
          <div key={s.id} className={styles.headCell}>
            <span className={styles.headName}>{s.name}</span>
            <span className={`num ${styles.headHours}`}>
              {s.start && s.end ? `${s.start.slice(0, 5)}–${s.end.slice(0, 5)}` : 'Ledig'}
            </span>
          </div>
        ))}
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
                  också med tangentbord (Enter/Space på knappen). */}
              <button
                type="button"
                className={styles.freeArea}
                aria-label={`Boka ledig tid hos ${s.name}`}
                onClick={(e) => {
                  const box = e.currentTarget.getBoundingClientRect()
                  const minute = dayStart + (e.clientY - box.top) / PX_PER_MIN
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
                  draggable={!isAvbokad(booking.status)}
                  showPhone
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
          // Alla resurser överlagras i veckovyn — identiteten står på blocket, så
          // man ser vems tid det är utan att färgen bär betydelsen.
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
}: {
  bookings: BookingRow[]
  tz: string
  date: string
  today: string
  onDayClick: (date: string) => void
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

  // Antal per dag — månadsvyn svarar på "hur full är dagen", inte "vilka tider".
  const perDay = useMemo(() => {
    const map = new Map<string, { total: number; pending: number }>()
    for (const b of bookings) {
      if (isAvbokad(b.status)) continue
      const key = dayKey(b.startTs, tz)
      const cur = map.get(key) ?? { total: 0, pending: 0 }
      cur.total += 1
      if (b.status === 'pending') cur.pending += 1
      map.set(key, cur)
    }
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
          const stats = perDay.get(key)
          const dayNum = Number(key.slice(8, 10))
          return (
            <button
              key={key}
              type="button"
              className={`${styles.monthCell}${inMonth ? '' : ` ${styles.monthCellOut}`}${key === today ? ` ${styles.monthCellToday}` : ''}`}
              onClick={() => onDayClick(key)}
              aria-label={`${key}${stats ? `, ${stats.total} bokningar` : ', inga bokningar'}`}
            >
              <span className={`num ${styles.monthDayNum}`}>{dayNum}</span>
              {stats ? (
                <span className={styles.monthCount}>
                  <span className="num">{stats.total}</span> bokningar
                  {stats.pending > 0 && (
                    <span className={styles.monthPending}>
                      <Icon name="alert" size={10} /> {stats.pending}
                    </span>
                  )}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
