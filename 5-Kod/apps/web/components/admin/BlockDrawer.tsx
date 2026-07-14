'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBlock, removeBlock } from '@/lib/admin/calendar-actions'
import { REPEAT_KINDS, REPEAT_LABELS, type RepeatKind } from '@/lib/admin/block-series'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { Button, Callout, Modal, useToast } from '@/components/portal/ui'
import type { CalendarBlock, CalendarStaff } from './CalendarBoard'
import styles from './calendar.module.css'

/** Blockera tid — samma yta för att skapa och för att ta bort (goal-66, B-22).
 *
 *  EN mekanism för rast, frånvaro och avvikande arbetstid. Blockerad tid försvinner
 *  omedelbart ur den publika bokningen: det är samma time_off-rader som bokningsmotorn
 *  redan räknar som upptagna. Ingen parallell "schemaundantag"-modell. */

/** Snabbval — de tre orsaker som faktiskt används dagligen. Fritext för resten. */
const REASONS = ['Rast', 'Frånvaro', 'Möte']

/** Snabbval för längd. GENVÄGAR, inte gränser: de sätter bara sluttiden, som sedan går
 *  att ändra fritt. Förut VAR de gränsen — man kunde inte blockera 3 timmar, och inte
 *  en hel semestervecka. Servern har alltid tillåtit godtycklig start/slut. */
const LENGTHS = [30, 60, 120, 240]

const pad = (n: number) => String(n).padStart(2, '0')
const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

/** Lägg minuter till en (datum, tid) och få tillbaka nytt datum + ny tid. Bär över
 *  dygnsgränsen — en blockering får sträcka sig in i nästa dag. */
function addMinutes(date: string, time: string, mins: number): { date: string; time: string } {
  const [h = 0, m = 0] = time.split(':').map(Number)
  const d = new Date(`${date}T00:00:00`)
  d.setMinutes(d.getMinutes() + h * 60 + m + mins)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

export function BlockDrawer({
  staff,
  date,
  tz,
  /** Förifyllt från ett klick i gridet: resurs + starttid (minuter efter midnatt). */
  seed,
  /** Satt när en BEFINTLIG blockering öppnats — då visas ta bort-vägen i stället. */
  existing,
  onClose,
}: {
  staff: CalendarStaff[]
  date: string
  tz: string
  seed: { staffId: string; startMinute: number } | null
  existing: CalendarBlock | null
  onClose: () => void
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [busy, startAction] = useTransition()

  const [staffId, setStaffId] = useState(seed?.staffId ?? staff[0]?.id ?? '')
  // FRÅN och TILL som fyra fria fält (datum + tid × 2) i stället för "start + en av sex
  // fasta längder". Zivar: "man ska kunna välja valfri tid när till när och kanske flera
  // dagar". Servern (createBlock) har alltid tagit godtycklig start/slut — det var bara
  // formuläret som låste. En hel semestervecka är nu samma handgrepp som en rast.
  const seedTime = fromMin(seed?.startMinute ?? 12 * 60)
  const [startDate, setStartDate] = useState(date)
  const [startTime, setStartTime] = useState(seedTime)
  const seedEnd = addMinutes(date, seedTime, 60)
  const [endDate, setEndDate] = useState(seedEnd.date)
  const [endTime, setEndTime] = useState(seedEnd.time)
  const [reason, setReason] = useState('Rast')
  const [repeat, setRepeat] = useState<RepeatKind>('ingen')

  /** Snabbval: sätt sluttiden till start + n minuter. Bara en genväg — fälten går att
   *  ändra efteråt. */
  const setLength = (mins: number) => {
    const e = addMinutes(startDate, startTime, mins)
    setEndDate(e.date)
    setEndTime(e.time)
  }

  // Sluttiden måste ligga efter starttiden. Vi VISAR felet i stället för att låta
  // servern kasta tillbaka det: användaren ska se det medan hen skriver.
  const startsAt = new Date(`${startDate}T${startTime}`)
  const endsAt = new Date(`${endDate}T${endTime}`)
  const invalid = !(endsAt > startsAt)
  const spansDays = startDate !== endDate

  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    )

  const save = () => {
    startAction(async () => {
      // Varje ände har sitt EGET datum — det är det som gör flerdygnsblockeringen möjlig.
      const startIso = zonedTimeToUtc(startDate, startTime, tz).toISOString()
      const endIso = zonedTimeToUtc(endDate, endTime, tz).toISOString()
      const res = await createBlock({ staffId, startIso, endIso, reason, repeat })
      if (res.error) notify(res.error, 'warning')
      else {
        notify(res.success ?? 'Tiden är blockerad.', 'success')
        router.refresh()
        onClose()
      }
    })
  }

  const remove = (scope: 'en' | 'framat') => {
    if (!existing) return
    startAction(async () => {
      const res = await removeBlock(existing.id, scope)
      if (res.error) notify(res.error, 'warning')
      else {
        notify(res.success ?? 'Blockeringen är borttagen.', 'success')
        router.refresh()
        onClose()
      }
    })
  }

  // ── Befintlig blockering: visa vad den är, och erbjud att ta bort den. ──
  if (existing) {
    const staffName = staff.find((s) => s.id === existing.staffId)?.name ?? 'Personal'
    return (
      <Modal
        title="Blockerad tid"
        sub={`${timeOf(existing.startTs)}–${timeOf(existing.endTs)} · ${staffName}`}
        onClose={onClose}
        ariaLabel="Blockerad tid"
        footer={
          existing.seriesId ? (
            // Serieblockering: TVÅ tydliga vägar (B-23). "Framåt" raderar aldrig
            // bakåt — förra veckans rast är historik, inte något att skriva om.
            <div style={{ display: 'grid', gap: 8, width: '100%' }}>
              <Button
                variant="ghost"
                icon="x"
                onClick={() => remove('en')}
                disabled={busy}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {busy ? 'Tar bort…' : 'Ta bort endast denna'}
              </Button>
              <Button
                variant="ghost"
                icon="x"
                onClick={() => remove('framat')}
                disabled={busy}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  color: 'var(--c-danger)',
                  borderColor: 'var(--c-danger)',
                }}
              >
                {busy ? 'Tar bort…' : 'Ta bort denna och alla framåt'}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              icon="x"
              onClick={() => remove('en')}
              disabled={busy}
              style={{
                width: '100%',
                justifyContent: 'center',
                color: 'var(--c-danger)',
                borderColor: 'var(--c-danger)',
              }}
            >
              {busy ? 'Tar bort…' : 'Ta bort blockeringen'}
            </Button>
          )
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Orsak
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--c-ink)' }}>
              {existing.reason}
              {existing.seriesId && (
                <span style={{ color: 'var(--c-ink-3)' }}> · återkommande</span>
              )}
            </p>
          </div>
          <Callout tone="info" icon="info">
            Tiden går inte att boka — varken av dig eller av en kund på sajten. Tar du bort
            blockeringen blir den bokningsbar igen. Bokningar som redan ligger i tiden påverkas
            inte.
          </Callout>
        </div>
      </Modal>
    )
  }

  // ── Ny blockering. ──
  return (
    <Modal
      title="Blockera tid"
      sub={
        invalid
          ? 'Sluttiden måste vara efter starttiden'
          : spansDays
            ? `${startDate} ${startTime} → ${endDate} ${endTime}`
            : `${startTime}–${endTime}`
      }
      onClose={onClose}
      ariaLabel="Blockera tid"
      footer={
        <Button
          variant="primary"
          icon="check"
          onClick={save}
          disabled={busy || !staffId || invalid}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {busy ? 'Sparar…' : 'Blockera'}
        </Button>
      }
    >
      {/* Kompakt rutnät, inte en lång remsa. Formuläret rymdes förut inte i dialogen och
          fick en scrollhiss mitt i innehållet — nu ligger fälten parvis och allt syns
          på en gång. Färre sektioner, samma information. */}
      <div className={styles.blockForm}>
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Vem
          </div>
          <div className={styles.chipRow}>
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.chip}${staffId === s.id ? ` ${styles.chipOn}` : ''}`}
                onClick={() => setStaffId(s.id)}
                aria-pressed={staffId === s.id}
              >
                <span className={styles.chipName}>{s.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* FRÅN → TILL. Två datum, inte ett: en blockering får sträcka sig över flera
            dygn (semester, sjukfrånvaro, mässa). */}
        <section className={styles.blockSpan}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Från
            </div>
            <div className={styles.blockPair}>
              <input
                className={styles.input}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Startdatum"
              />
              <input
                className={styles.input}
                type="time"
                step={900}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label="Starttid"
              />
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Till
            </div>
            <div className={styles.blockPair}>
              <input
                className={styles.input}
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="Slutdatum"
              />
              <input
                className={styles.input}
                type="time"
                step={900}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-label="Sluttid"
              />
            </div>
          </div>
        </section>

        {/* Genvägar, inte gränser: de sätter sluttiden, fälten ovan går att ändra efteråt. */}
        <div className={styles.chipRow}>
          {LENGTHS.map((len) => (
            <button
              key={len}
              type="button"
              className={styles.slotChip}
              onClick={() => setLength(len)}
            >
              {len < 60 ? `${len} min` : `${len / 60} h`}
            </button>
          ))}
        </div>

        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Orsak <span style={{ textTransform: 'none' }}>(syns aldrig för kunden)</span>
          </div>
          <div className={styles.chipRow} style={{ marginBottom: 8 }}>
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`${styles.slotChip}${reason === r ? ` ${styles.chipOn}` : ''}`}
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            className={styles.input}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Egen text"
            aria-label="Orsak"
          />
        </section>

        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Upprepa
          </div>
          {/* Native <select>: sex fasta val behöver ingen egen komponent, och
              telefonens inbyggda väljare är bättre än allt vi kan bygga. */}
          <select
            className={styles.input}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as RepeatKind)}
            aria-label="Upprepning"
          >
            {REPEAT_KINDS.map((k) => (
              <option key={k} value={k}>
                {REPEAT_LABELS[k]}
              </option>
            ))}
          </select>
        </section>

        {spansDays && !invalid && (
          <Callout tone="info" icon="info">
            Blockeringen sträcker sig över flera dagar — hela perioden går inte att boka.
          </Callout>
        )}
      </div>
    </Modal>
  )
}
