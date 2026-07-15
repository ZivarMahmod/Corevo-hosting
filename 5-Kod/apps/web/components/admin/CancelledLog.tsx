'use client'

import { useState, useTransition } from 'react'
import { Icon, Modal } from '@/components/portal/ui'
import { loadCancelled, restoreBooking, type CancelledBooking } from '@/lib/admin/calendar-actions'
import styles from './calendar.module.css'

/** Ångraloggen (goal-66, B-24).
 *
 *  En avbokning är det enda i kalendern som INTE går att se sig ur: tiden försvinner,
 *  och frågan "vem avbokade Anna?" har inget svar. Wavys trygghet sitter exakt där —
 *  30 dagars logg, med en väg tillbaka.
 *
 *  Fönstret är 30 dagar av en anledning: en felavbokning upptäcks samma vecka. En
 *  obegränsad logg blir ett arkiv ingen läser.
 *
 *  Läses först när loggen öppnas. Kalendern renderas femtio gånger om dagen; loggen
 *  öppnas kanske en gång i veckan — den frågan hör inte hemma i sidladdningen. */

const WHO: Record<string, string> = {
  customer: 'Kunden avbokade själv',
  business: 'Avbokad här i adminen',
  system: 'Avbokad automatiskt',
}

function when(iso: string | null): string {
  // Avbokningar före migration 0060 saknar tidsstämpel. Vi SÄGER det i stället för
  // att gissa ett datum — en påhittad historik är värre än ingen.
  if (!iso) return 'Okänt när'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days === 0) return 'Idag'
  if (days === 1) return 'Igår'
  return `För ${days} dagar sedan`
}

function slotLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(new Date(iso))
}

export function CancelledLog({ tz, label }: { tz: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<CancelledBooking[] | null>(null)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [pending, startTransition] = useTransition()

  function openLog() {
    setOpen(true)
    setMsg(null)
    setRows(null)
    startTransition(async () => setRows(await loadCancelled()))
  }

  function restore(id: string) {
    startTransition(async () => {
      const res = await restoreBooking(id)
      if (res.error) {
        setMsg({ text: res.error, bad: true })
        return
      }
      setMsg({ text: res.success ?? 'Bokningen är återställd.' })
      // Raden ska bort ur loggen direkt — den är ju inte avbokad längre.
      setRows((prev) => prev?.filter((r) => r.id !== id) ?? null)
    })
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.helpBtn}${label ? ` ${styles.helpBtnLabelled}` : ''}`}
        onClick={openLog}
        aria-label="Avbokade tider"
        title="Avbokade tider"
      >
        <Icon name="undo" size={16} />
        {label && <span>{label}</span>}
      </button>

      {open && (
        <Modal
          title="Avbokade tider"
          sub="Senaste 30 dagarna"
          onClose={() => setOpen(false)}
          ariaLabel="Avbokade tider"
        >
          {msg && (
            <p className={msg.bad ? styles.logError : styles.logOk} role="status">
              {msg.text}
            </p>
          )}

          {rows === null && <p className={styles.logEmpty}>Hämtar…</p>}

          {rows?.length === 0 && (
            <p className={styles.logEmpty}>Inga avbokningar de senaste 30 dagarna.</p>
          )}

          {rows && rows.length > 0 && (
            <ul className={styles.logList}>
              {rows.map((r) => (
                <li key={r.id} className={styles.logItem}>
                  <div className={styles.logMain}>
                    <strong className={styles.logName}>{r.customerName}</strong>
                    <span className={styles.logMeta}>
                      {r.serviceName}
                      {r.staffTitle ? ` · ${r.staffTitle}` : ''}
                    </span>
                    <span className={styles.logMeta}>{slotLabel(r.startTs, tz)}</span>
                    <span className={styles.logWho}>
                      {when(r.cancelledAt)}
                      {r.cancelledBy ? ` · ${WHO[r.cancelledBy]}` : ''}
                    </span>
                  </div>

                  {/* En passerad tid går inte att återställa — det vore att boka in
                      någon i går. Vi säger varför i stället för att visa en knapp
                      som bara skulle misslyckas. */}
                  {r.isPast ? (
                    <span className={styles.logPast}>Tiden har passerat</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.logRestore}
                      onClick={() => restore(r.id)}
                      disabled={pending}
                    >
                      <Icon name="undo" size={14} />
                      Återställ
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  )
}
