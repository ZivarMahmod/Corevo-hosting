'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { SlotRow, LocationRow, WorkingHourRow } from '@/lib/admin/data'
import {
  addStaffSlots,
  deleteStaffSlot,
  seedStaffSlots,
  addStaffWorkingHours,
  deleteStaffWorkingHours,
  type ActionState,
} from '@/lib/admin/actions'
import { WEEKDAYS_SV } from '@/lib/admin/format'
import { Button, Callout, Icon, useToast } from '@/components/portal/ui'
import { LocationSelect } from './LocationSelect'

/**
 * §4.5 Schema — bokbara starttider i en veckovy (Mån–Sön), exakt copy av
 * design-mockens komposition (ServicesSchema.jsx → SalonSchedule):
 *   • PageHead-actions "Återställ mönster" + "Spara schema" (ägs av page.tsx)
 *   • frisör-väljare = färgade avatar-pill-chips (inte dropdown)
 *   • 7-dagars rutnät: dagens kolumn guld-tonad, success-bg tidchips med × i cellen,
 *     streckad "+ Tid" per dag för att lägga till direkt i rutnätet.
 *
 * SANNINGSLAGER: vi använder det redan byggda data-lagret (working_hour_slots).
 * Varje × / + är en RIKTIG mutation (deleteStaffSlot / addStaffSlots) som sparas
 * direkt — det finns ingen batch-utkastmodell i schemat, så "Spara schema"
 * synkar bara om serverns vy (router.refresh) med en ärlig bekräftelse i stället
 * för att fejka en spara-knapp. Mockens STAFF[].color saknar DB-kolumn → avatar-
 * färgen härleds deterministiskt ur en fast palett (rent presentation, aldrig
 * påhittad data). En dag utan bokbara tider visar en slot-ärlig tom-hint ("Inga
 * bokbara tider ännu") — inte en fabricerad "stängd"-flagga (en dag kan ha
 * arbetstider men ännu inga genererade starttider).
 */

/** A single weekday column, derived DST-safe server-side (page.tsx). */
export type WeekCol = {
  /** working_hours.weekday: 0 = Sön … 6 = Lör. */
  wd: number
  /** Kort dagnamn, "Mån" … "Sön". */
  name: string
  /** Datum-i-månaden för den här veckans kolumn. */
  dayOfMonth: number
  isToday: boolean
}

/** A staff chip's identity for the colored pill selector. */
export type StaffChip = {
  id: string
  displayName: string
  active: boolean
}

// Avatar-färg härledd ur en fast back-office-palett (forest/grön/guld-toner ur
// --c-*-familjen). INGEN färgkolumn finns på staff (frozen types) — detta är ren
// presentation, indexerad på medarbetarens position, aldrig sparad data.
const AVATAR_COLORS = ['var(--c-forest)', 'var(--c-success)', 'var(--c-gold-600)']
const HHMM = /^\d{1,2}:\d{2}$/

// Tvåstegs-borttagning (samma röda tråd som ServicesManager/StaffRoster): klick 1
// ARMERAR, klick 2 raderar. Knapp-tonerna nedan är de enda "danger"-ytorna i den
// här filen — samma --c-danger-token som resten av back-office.
const confirmBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  border: '1px solid var(--c-danger, #b3261e)',
  borderRadius: 7,
  background: 'transparent',
  color: 'var(--c-danger, #b3261e)',
  fontFamily: 'var(--font-ui)',
  fontSize: 11.5,
  fontWeight: 700,
  lineHeight: 1.2,
  padding: '4px 7px',
} as const
const undoBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--c-line)',
  borderRadius: 7,
  background: 'var(--c-paper)',
  color: 'var(--c-ink-3)',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontSize: 11.5,
  fontWeight: 600,
  lineHeight: 1.2,
  padding: '4px 7px',
} as const

export function SlotManager({
  staffId,
  staff,
  rows,
  weekCols,
  locations,
  defaultLocationId,
}: {
  staffId: string
  staff: StaffChip[]
  rows: SlotRow[]
  weekCols: WeekCol[]
  // Multi-location är SHIPPAD funktion: med >1 aktiv plats väljer ägaren i in-grid-
  // formuläret VILKEN plats den nya tiden gäller (servern keyar tillgänglighet på
  // slot.location_id). Med EN plats emittar LocationSelect bara ett dolt fält →
  // uncluttered, och servern faller tillbaka på medarbetarens/primär plats.
  locations: LocationRow[]
  defaultLocationId: string
}) {
  const router = useRouter()

  // Grupp aktiva starttider per veckodag (HH:MM, sorterade) — speglar listWorkingHourSlots.
  const byDay = new Map<number, string[]>()
  for (const r of rows) {
    const arr = byDay.get(r.weekday) ?? []
    arr.push(r.start_time.slice(0, 5))
    byDay.set(r.weekday, arr)
  }
  for (const arr of byDay.values()) arr.sort((a, b) => a.localeCompare(b))

  // id-uppslag för in-cell-borttagning (weekday + HH:MM → slot-id).
  const idByKey = new Map<string, string>()
  for (const r of rows) idByKey.set(`${r.weekday}|${r.start_time.slice(0, 5)}`, r.id)

  return (
    <div>
      {/* Frisör-väljare: färgade avatar-pill-chips (mock §4.5) */}
      <StaffChips staff={staff} selectedId={staffId} />

      {/* Röd-tråd-callout — copy VERBATIM ur mocken (ServicesSchema.jsx rad 88).
          Mockens glyf är "sparkle" (saknas i Icon-setet) → närmaste godkända accent =
          "info" (mock-CODE sätter --c-info-bg + --c-info, dvs tone="info"). */}
      <div style={{ marginBottom: 16 }}>
        <Callout tone="info" icon="info">
          Upplägget är förinställt från verksamhetens nuvarande mönster. Justera per dag — minimalt
          manuellt arbete, alltid rätt tider uppe.
        </Callout>
      </div>

      {/* A7-ärlighet: publika bokningsmotorn läser working_hours (veckoschemat),
          inte working_hour_slots — säg det rakt ut istället för att låtsas. */}
      <div style={{ marginBottom: 16 }}>
        <Callout tone="info" icon="info">
          Obs: exakta tider här styr ännu inte den publika bokningen — den utgår från
          veckoschemat.
        </Callout>
      </div>

      {/* 7-dagars rutnät — dagens kolumn guld-tonad, in-cell × + "+ Tid" */}
      <WeekGrid
        weekCols={weekCols}
        byDay={byDay}
        idByKey={idByKey}
        staffId={staffId}
        locations={locations}
        defaultLocationId={defaultLocationId}
        onMutated={() => router.refresh()}
      />
    </div>
  )
}

// ── Frisör-chips (färgad avatar + förnamn, aktiv = forest-fylld) ───────────────
function StaffChips({ staff, selectedId }: { staff: StaffChip[]; selectedId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
        opacity: pending ? 0.6 : 1,
        transition: 'opacity var(--dur-fast, 0.12s)',
      }}
    >
      <span className="small" style={{ marginRight: 4 }}>
        Personal:
      </span>
      {staff.map((s, i) => {
        const sel = s.id === selectedId
        const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
        const initial = s.displayName.trim().charAt(0).toUpperCase() || '?'
        const first = s.displayName.trim().split(/\s+/)[0] || s.displayName
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => start(() => router.push(`/admin/scheman?staff=${s.id}`))}
            aria-pressed={sel}
            title={s.active ? s.displayName : `${s.displayName} (inaktiv)`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 13px',
              borderRadius: 999,
              border: `1.5px solid ${sel ? 'var(--c-forest)' : 'var(--c-line)'}`,
              background: sel ? 'var(--c-forest)' : 'var(--c-paper)',
              color: sel ? '#fff' : 'var(--c-ink-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              fontWeight: 600,
              opacity: s.active ? 1 : 0.55,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: color,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {initial}
            </span>
            {first}
            {!s.active && (
              <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>(inaktiv)</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Veckorutnät (Mån–Sön, Card pad=0) ─────────────────────────────────────────
function WeekGrid({
  weekCols,
  byDay,
  idByKey,
  staffId,
  locations,
  defaultLocationId,
  onMutated,
}: {
  weekCols: WeekCol[]
  byDay: Map<number, string[]>
  idByKey: Map<string, string>
  staffId: string
  locations: LocationRow[]
  defaultLocationId: string
  onMutated: () => void
}) {
  return (
    <>
      <style>{`
        .scheman-week { grid-template-columns: repeat(7, 1fr); }
        @media (max-width: 920px) { .scheman-week { grid-template-columns: 1fr; } }
      `}</style>
      <div
        style={{
          background: 'var(--c-paper)',
          border: '1px solid var(--c-line)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <div className="scheman-week" style={{ display: 'grid' }}>
          {weekCols.map((col, i) => {
            const times = byDay.get(col.wd) ?? []
            return (
              <div
                key={col.wd}
                style={{
                  minHeight: 360,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: i < weekCols.length - 1 ? '1px solid var(--c-line)' : 'none',
                }}
              >
                {/* Dag-rubrik — guld fyllning ENBART på dagens kolumn (sidans enda guldfält) */}
                <div
                  style={{
                    textAlign: 'center',
                    padding: '14px 12px 12px',
                    borderBottom: '1px solid var(--c-line)',
                    background: col.isToday ? 'var(--c-gold-100)' : 'transparent',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--c-ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '.05em',
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {col.name}
                  </div>
                  <div
                    className="num"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--c-forest)',
                      lineHeight: 1.1,
                      marginTop: 2,
                    }}
                  >
                    {col.dayOfMonth}
                  </div>
                  <div className="num" style={{ fontSize: 11, color: 'var(--c-ink-3)', marginTop: 2 }}>
                    {times.length} {times.length === 1 ? 'tid' : 'tider'}
                  </div>
                </div>

                {/* Cellinnehåll: tidchips (× tar bort) + "+ Tid". Tom dag = en slot-
                    ärlig tom-hint ("Inga bokbara tider ännu") + add — aldrig en
                    fabricerad "stängt"-flagga (en dag kan ha arbetstider men ännu
                    inga genererade starttider). Alla 7 dagar är hanterbara. */}
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                  {times.length === 0 && <EmptyDayHint />}
                  {times.map((t) => {
                    const id = idByKey.get(`${col.wd}|${t}`)
                    return id ? (
                      <SlotChip key={`${col.wd}-${t}`} id={id} time={t} onDone={onMutated} />
                    ) : null
                  })}
                  <AddSlot
                    staffId={staffId}
                    weekday={col.wd}
                    dayName={col.name}
                    existing={times}
                    locations={locations}
                    defaultLocationId={defaultLocationId}
                    onDone={onMutated}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function EmptyDayHint() {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        padding: '12px 8px',
        textAlign: 'center',
        fontSize: 11.5,
        lineHeight: 1.4,
        color: 'var(--c-ink-3)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      Inga bokbara tider ännu
    </div>
  )
}

// ── In-cell tidchip med × (riktig deleteStaffSlot) ─────────────────────────────
function SlotChip({ id, time, onDone }: { id: string; time: string; onDone: () => void }) {
  const { notify } = useToast()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteStaffSlot, {})
  // Tvåstegsbekräftelse: × raderade tidigare en bokbar tid på ETT klick. Klick 1
  // armerar (chipet visar "Säker? Ta bort permanent" i varningston + en Ångra),
  // klick 2 skickar delete-formuläret. Armeringen är lokal per chip.
  const [armed, setArmed] = useState(false)

  // Vakta på resultat-objektet (en lyckad borttagning avmonterar visserligen chipet,
  // men ett upprepat identiskt FEL ska ändå ge toast).
  const lastHandled = useRef(state)
  useEffect(() => {
    if (state === lastHandled.current) return
    lastHandled.current = state
    if (state.success) {
      notify(`Tid ${time} borttagen — inte längre bokningsbar.`, 'success')
      onDone()
    } else if (state.error) {
      notify(state.error, 'warning')
    }
  }, [state, time, notify, onDone])

  return (
    <form action={formAction} style={{ margin: 0 }}>
      <input type="hidden" name="id" value={id} />
      <div
        style={{
          display: 'flex',
          flexDirection: armed ? 'column' : 'row',
          alignItems: armed ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: armed ? 6 : 0,
          padding: '8px 10px',
          borderRadius: 9,
          background: 'var(--c-success-bg)',
          opacity: pending ? 0.5 : 1,
        }}
      >
        <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-success)' }}>
          {time}
        </span>
        {armed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              type="submit"
              disabled={pending}
              aria-label={`Säker? Ta bort ${time} permanent`}
              style={{ ...confirmBtnStyle, cursor: pending ? 'default' : 'pointer' }}
            >
              <Icon name="trash" size={12} />
              {pending ? '…' : 'Säker? Ta bort permanent'}
            </button>
            <button type="button" onClick={() => setArmed(false)} style={undoBtnStyle}>
              Ångra
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setArmed(true)}
            aria-label={`Ta bort ${time}`}
            title="Ta bort denna tid"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--c-ink-3)',
              cursor: 'pointer',
              padding: 0,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </form>
  )
}

// ── Per-dag "+ Tid" (in-grid inline-input → riktig addStaffSlots) ──────────────
function AddSlot({
  staffId,
  weekday,
  dayName,
  existing,
  locations,
  defaultLocationId,
  onDone,
}: {
  staffId: string
  weekday: number
  dayName: string
  existing: string[]
  locations: LocationRow[]
  defaultLocationId: string
  onDone: () => void
}) {
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addStaffSlots, {})

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Reagera per RESULTAT-objekt, inte per success-STRÄNG: useActionState ger ett
  // NYTT state-objekt vid varje dispatch, men strängen kan vara identisk ("Tid
  // sparad.") vid två likadana tillägg → en [state.success]-dep skulle hoppa över
  // andra gången och formuläret såg "fast" ut. Vakta på objekt-identitet i stället.
  const lastHandled = useRef(state)
  useEffect(() => {
    if (state === lastHandled.current) return
    lastHandled.current = state
    if (state.success) {
      notify(`${state.success} (${dayName})`, 'success')
      setValue('')
      setOpen(false)
      onDone()
    } else if (state.error) {
      notify(state.error, 'warning')
    }
  }, [state, dayName, notify, onDone])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '8px 10px',
          borderRadius: 9,
          border: '1px dashed var(--c-line-strong)',
          background: 'transparent',
          color: 'var(--c-ink-3)',
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        <Icon name="plus" size={14} /> Tid
      </button>
    )
  }

  const valid = HHMM.test(value.trim())
  const dup = existing.includes(value.trim())

  return (
    <form
      action={formAction}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        borderRadius: 9,
        border: '1px dashed var(--c-line-strong)',
        background: 'var(--c-paper-2)',
      }}
    >
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="weekday" value={weekday} />
      {/* Multi-location: med >1 plats väljer ägaren plats; annars dolt fält. */}
      <LocationSelect locations={locations} defaultLocationId={defaultLocationId} />
      <input
        ref={inputRef}
        name="start_times"
        type="time"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`Ny tid för ${dayName} (HH:MM)`}
        style={{
          font: 'inherit',
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          padding: '6px 8px',
          borderRadius: 7,
          border: '1px solid var(--c-line)',
          background: 'var(--c-paper)',
          color: 'var(--c-ink)',
        }}
      />
      {dup && (
        <span style={{ fontSize: 11, color: 'var(--c-ink-3)' }}>Tiden finns redan denna dag.</span>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="submit"
          disabled={pending || !valid}
          style={{
            flex: 1,
            border: 'none',
            borderRadius: 7,
            padding: '6px 8px',
            background: valid ? 'var(--c-forest)' : 'var(--c-line-strong)',
            color: '#fff',
            cursor: valid && !pending ? 'pointer' : 'default',
            fontFamily: 'var(--font-ui)',
            fontSize: 12.5,
            fontWeight: 600,
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? 'Sparar…' : 'Lägg till'}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue('')
            setOpen(false)
          }}
          aria-label="Avbryt"
          style={{
            border: '1px solid var(--c-line)',
            borderRadius: 7,
            padding: '6px 9px',
            background: 'var(--c-paper)',
            color: 'var(--c-ink-3)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="x" size={13} />
        </button>
      </div>
    </form>
  )
}

// ── Header-action: fyll bokbara tider ur arbetstiderna (seedStaffSlots). ───────
// Fd "Återställ mönster" + en fejkande "Spara schema"-knapp: spara-knappen är
// BORTA (varje ×/+ sparas redan direkt — knappen toastade "sparat" utan att göra
// något), och seeden heter det den GÖR så den inte krockar med schemalåsets
// "Återställ till innan upplåsningen".
export function ScheduleActions({ staffId }: { staffId: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [seedState, seedAction, seedPending] = useActionState<ActionState, FormData>(
    seedStaffSlots,
    {},
  )

  // Vakta på resultat-OBJEKTET (inte strängen) så två likadana körningar alltid
  // ger en toast — samma identitets-vakt som AddSlot.
  const lastSeed = useRef(seedState)
  useEffect(() => {
    if (seedState === lastSeed.current) return
    lastSeed.current = seedState
    if (seedState.success) {
      notify(seedState.success, 'success')
      router.refresh()
    } else if (seedState.error) {
      notify(seedState.error, 'warning')
    }
  }, [seedState, notify, router])

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <span className="small" style={{ color: 'var(--c-ink-3)' }}>
        Varje ändring sparas direkt.
      </span>
      <form action={seedAction} style={{ margin: 0 }}>
        <input type="hidden" name="staff_id" value={staffId} />
        {/* Standardsteg 15 min — samma som arbetstids-rastrets generering. */}
        <input type="hidden" name="step" value="15" />
        <Button variant="ghost" icon="undo" type="submit" disabled={seedPending}>
          {seedPending ? 'Fyller…' : 'Fyll tider från arbetstiderna'}
        </Button>
      </form>
    </div>
  )
}

// ── Arbetstider (öppet–stängt) — SHIPPAD funktion utan mock-motsvarighet ───────
// 3-vägstestet: mocken har INGEN arbetstids-editor → BEHÅLL men STYLA OM till
// design-grammatiken. Detta sätter salongens publika öppettider och är rastret
// de bokbara tiderna genereras ur (riktiga mutationer: addStaffWorkingHours /
// deleteStaffWorkingHours). Visuellt UNDERORDNAD rutnätet: hårfina rader (inga
// skuggade kort), dämpat bläck, subtil "Lägg till" (ALDRIG forest/guld-CTA som
// tävlar med "Spara schema"), guld endast som accent. All funktion bevaras —
// veckodag/från/till-formuläret, LocationSelect, rad-listan, per-rad-borttagning
// och ett skrivet tomtillstånd — endast tonen är nedtonad.
export function WorkingHoursEditor({
  staffId,
  staffName,
  rows,
  locations,
  defaultLocationId,
}: {
  staffId: string
  staffName: string
  rows: WorkingHourRow[]
  locations: LocationRow[]
  defaultLocationId: string
}) {
  const router = useRouter()
  const sorted = [...rows].sort(
    (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
  )
  return (
    <section style={{ marginTop: '2.25rem' }}>
      {/* eyebrow + Playfair-h2 + sub — egen sektionsrubrik i grammatiken */}
      <span className="eyebrow" style={{ color: 'var(--c-gold-600)' }}>
        Öppettider
      </span>
      <h2 className="h2" style={{ margin: '6px 0 0' }}>
        Arbetstider (öppet–stängt)
      </h2>
      <p className="small" style={{ margin: '4px 0 0', maxWidth: 560, color: 'var(--c-ink-3)' }}>
        Veckovisa intervall för {staffName} — styr salongens öppettider på den publika sajten och
        är grunden de bokbara tiderna ovan genereras ur.
      </p>

      <WorkingHoursAddRow
        staffId={staffId}
        locations={locations}
        defaultLocationId={defaultLocationId}
        onDone={() => router.refresh()}
      />

      {sorted.length === 0 ? (
        <p
          className="small"
          style={{
            margin: '0.85rem 0 0',
            padding: '0.85rem 0',
            borderTop: '1px solid var(--c-line)',
            color: 'var(--c-ink-3)',
          }}
        >
          <strong style={{ fontWeight: 600, color: 'var(--c-ink-2)' }}>
            Inga arbetstider satta ännu.
          </strong>{' '}
          Lägg till ett veckointervall ovan — bokningsmotorn erbjuder bara tider inom dessa.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: '0.85rem 0 0',
            padding: 0,
            borderTop: '1px solid var(--c-line)',
          }}
        >
          {sorted.map((r) => (
            <WorkingHourRowItem key={r.id} row={r} onDone={() => router.refresh()} />
          ))}
        </ul>
      )}
    </section>
  )
}

// In-line tillägg: veckodag + från + till + LocationSelect → addStaffWorkingHours.
// Subtil rad (paper-2-band, hårfin ram) i stället för det skuggade kortet.
function WorkingHoursAddRow({
  staffId,
  locations,
  defaultLocationId,
  onDone,
}: {
  staffId: string
  locations: LocationRow[]
  defaultLocationId: string
  onDone: () => void
}) {
  const { notify } = useToast()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addStaffWorkingHours,
    {},
  )

  const lastHandled = useRef(state)
  useEffect(() => {
    if (state === lastHandled.current) return
    lastHandled.current = state
    if (state.success) {
      notify(state.success, 'success')
      onDone()
    } else if (state.error) {
      notify(state.error, 'warning')
    }
  }, [state, notify, onDone])

  const fieldStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    fontSize: 12,
    color: 'var(--c-ink-3)',
    fontFamily: 'var(--font-ui)',
  }
  const inputStyle = {
    font: 'inherit' as const,
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    padding: '6px 9px',
    borderRadius: 8,
    border: '1px solid var(--c-line)',
    background: 'var(--c-paper)',
    color: 'var(--c-ink)',
  }

  return (
    <form
      action={formAction}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'flex-end',
        margin: '1rem 0 0',
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--c-line)',
        background: 'var(--c-paper-2)',
      }}
    >
      <input type="hidden" name="staff_id" value={staffId} />
      <LocationSelect locations={locations} defaultLocationId={defaultLocationId} />
      <label style={fieldStyle}>
        <span>Veckodag</span>
        <select name="weekday" defaultValue="1" style={inputStyle}>
          {WEEKDAYS_SV.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label style={fieldStyle}>
        <span>Från</span>
        <input name="start_time" type="time" defaultValue="09:00" required style={inputStyle} />
      </label>
      <label style={fieldStyle}>
        <span>Till</span>
        <input name="end_time" type="time" defaultValue="17:00" required style={inputStyle} />
      </label>
      {/* Subtil ghost-CTA — tävlar ALDRIG med forest "Spara schema" / "+ Tid". */}
      <Button variant="ghost" size="sm" icon="plus" type="submit" disabled={pending}>
        {pending ? 'Sparar…' : 'Lägg till'}
      </Button>
    </form>
  )
}

// Hårfin rad: veckodag + intervall till vänster, dämpad ghost-borttagning till
// höger (riktig deleteStaffWorkingHours + en svensk följd-toast).
function WorkingHourRowItem({ row, onDone }: { row: WorkingHourRow; onDone: () => void }) {
  const { notify } = useToast()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteStaffWorkingHours,
    {},
  )
  // Tvåstegsbekräftelse — arbetstiden är rastret bokningarna genereras ur och
  // raderades förr på ETT klick. Klick 1 armerar, klick 2 skickar formuläret.
  const [armed, setArmed] = useState(false)
  const label = `${WEEKDAYS_SV[row.weekday]} ${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}`

  const lastHandled = useRef(state)
  useEffect(() => {
    if (state === lastHandled.current) return
    lastHandled.current = state
    if (state.success) {
      notify(`Arbetstid borttagen — ${label}.`, 'success')
      onDone()
    } else if (state.error) {
      notify(state.error, 'warning')
    }
  }, [state, label, notify, onDone])

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '11px 2px',
        borderBottom: '1px solid var(--c-line)',
        opacity: pending ? 0.5 : 1,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          fontSize: 13.5,
          color: 'var(--c-ink)',
        }}
      >
        <Icon name="clock" size={15} style={{ color: 'var(--c-ink-3)', flex: 'none' }} />
        <span style={{ fontWeight: 600 }}>{WEEKDAYS_SV[row.weekday]}</span>
        <span className="num" style={{ color: 'var(--c-ink-2)' }}>
          {row.start_time.slice(0, 5)}–{row.end_time.slice(0, 5)}
        </span>
      </span>
      <form
        action={formAction}
        style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
      >
        <input type="hidden" name="id" value={row.id} />
        {armed ? (
          <>
            <button
              type="submit"
              disabled={pending}
              aria-label={`Säker? Ta bort ${label} permanent`}
              style={{ ...confirmBtnStyle, fontSize: 12.5, cursor: pending ? 'default' : 'pointer' }}
            >
              <Icon name="trash" size={14} />
              {pending ? '…' : 'Säker? Ta bort permanent'}
            </button>
            <button
              type="button"
              onClick={() => setArmed(false)}
              style={{ ...undoBtnStyle, fontSize: 12.5 }}
            >
              Ångra
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setArmed(true)}
            aria-label={`Ta bort ${label}`}
            title="Ta bort denna arbetstid"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: 'none',
              background: 'transparent',
              color: 'var(--c-ink-3)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              fontSize: 12.5,
              fontWeight: 600,
              padding: '4px 6px',
            }}
          >
            <Icon name="trash" size={14} /> Ta bort
          </button>
        )}
      </form>
    </li>
  )
}
