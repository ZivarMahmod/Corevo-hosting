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

/** Vanligaste längderna. 60 min är default (samma som Wavy). */
const LENGTHS = [15, 30, 45, 60, 90, 120]

const pad = (n: number) => String(n).padStart(2, '0')
const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

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
  const [startMin, setStartMin] = useState(seed?.startMinute ?? 12 * 60)
  const [lengthMin, setLengthMin] = useState(60)
  const [reason, setReason] = useState('Rast')
  const [repeat, setRepeat] = useState<RepeatKind>('ingen')

  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    )

  const save = () => {
    startAction(async () => {
      const startIso = zonedTimeToUtc(date, fromMin(startMin), tz).toISOString()
      const endIso = zonedTimeToUtc(date, fromMin(startMin + lengthMin), tz).toISOString()
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
      sub={`${fromMin(startMin)}–${fromMin(startMin + lengthMin)}`}
      onClose={onClose}
      ariaLabel="Blockera tid"
      footer={
        <Button
          variant="primary"
          icon="check"
          onClick={save}
          disabled={busy || !staffId}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {busy ? 'Sparar…' : 'Blockera'}
        </Button>
      }
    >
      <div style={{ display: 'grid', gap: 18 }}>
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

        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Start
          </div>
          <input
            className={styles.input}
            type="time"
            step={900}
            value={fromMin(startMin)}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number)
              if (Number.isFinite(h) && Number.isFinite(m)) setStartMin(h! * 60 + m!)
            }}
            aria-label="Starttid"
          />
        </section>

        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Hur länge
          </div>
          <div className={styles.chipRow}>
            {LENGTHS.map((len) => (
              <button
                key={len}
                type="button"
                className={`${styles.slotChip}${lengthMin === len ? ` ${styles.chipOn}` : ''}`}
                onClick={() => setLengthMin(len)}
                aria-pressed={lengthMin === len}
              >
                {len} min
              </button>
            ))}
          </div>
        </section>

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

        <Callout tone="info" icon="info">
          {repeat === 'ingen'
            ? 'Blockerad tid försvinner direkt ur den publika bokningen — kunder kan inte boka den.'
            : 'Upprepningen läggs in 12 månader framåt. Du kan ta bort ett enskilt tillfälle, eller ett tillfälle och alla efter det.'}
        </Callout>
      </div>
    </Modal>
  )
}
