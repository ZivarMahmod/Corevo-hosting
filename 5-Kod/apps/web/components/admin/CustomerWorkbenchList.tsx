'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './kunder-v2.module.css'

export type WorkbenchRow = {
  id: string
  initial: string
  name: string
  tag: 'NY' | 'STAM' | 'DOLD' | null
  last: string
  visits: number
  hidden: boolean
  isNew: boolean
  isReturning: boolean
  isInactive: boolean
}

const FILTERS = ['Alla', 'Nya', 'Stamkunder', 'Inaktiva', 'Dolda'] as const

const TAG_COLOR: Record<'NY' | 'STAM' | 'DOLD', string> = {
  NY: 'var(--c-gold)',
  STAM: 'var(--c-ink-3)',
  DOLD: 'var(--c-danger)',
}

/** Vänsterlistan i Kunder v2. Sök + filter körs på klienten över den lätta listan
 *  (ingen PII i raderna — telefon lever bara på kortet i driftfönstret). Vald rad
 *  markeras via pathname, så mjuk nav till /kunder/<id> aldrig laddar om listan. */
export function CustomerWorkbenchList({
  rows,
  monthLabel,
}: {
  rows: WorkbenchRow[]
  monthLabel: string
}) {
  const pathname = usePathname()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState(0)

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((c) => {
      if (filter === 4) {
        if (!c.hidden) return false
      } else if (c.hidden) return false
      if (filter === 1 && !c.isNew) return false
      if (filter === 2 && !c.isReturning) return false
      if (filter === 3 && !c.isInactive) return false
      if (term && !c.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [rows, q, filter])

  const nonHidden = rows.filter((c) => !c.hidden)
  const newCount = nonHidden.filter((c) => c.isNew).length
  const hiddenCount = rows.length - nonHidden.length
  const stat = `${nonHidden.length} kunder · ${newCount} nya i ${monthLabel} · ${hiddenCount} dold`

  return (
    <div className={styles.list}>
      <div className={styles.listHead}>
        <div className={styles.listTitleRow}>
          <div>
            <div className={styles.listTitle}>Kunder</div>
            <div className={styles.stat}>{stat}</div>
          </div>
          {/* Kunddatabasen byggs av bokningarna — ingen manuell "skapa kund".
              "+ Ny kund" leder till kalendern där en bokning föder kundraden. */}
          <Link href="/admin/bokningar" className={styles.newBtn}>
            + Ny kund
          </Link>
        </div>

        <label className={styles.search}>
          <span aria-hidden="true">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök namn…"
            aria-label="Sök kund på namn"
          />
        </label>

        <div className={styles.chips}>
          {FILTERS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setFilter(i)}
              className={`${styles.chip} ${i === filter ? styles.chipOn : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.rows}>
        {visible.length === 0 ? (
          <div className={styles.empty}>Ingen kund matchar.</div>
        ) : (
          visible.map((c) => {
            const selected = pathname === `/admin/kunder/${c.id}`
            return (
              <Link
                key={c.id}
                href={`/admin/kunder/${c.id}`}
                className={`${styles.row} ${selected ? styles.rowOn : ''} ${
                  c.hidden ? styles.rowHidden : ''
                }`}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {c.initial}
                </span>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>
                    <b>{c.name}</b>
                    {c.tag && (
                      <span className={styles.tag} style={{ color: TAG_COLOR[c.tag] }}>
                        {c.tag}
                      </span>
                    )}
                  </span>
                  <span className={styles.rowSub}>{c.visits} besök</span>
                </span>
                <span className={styles.rowMeta}>
                  <span className={styles.rowLast}>{c.last}</span>
                </span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
