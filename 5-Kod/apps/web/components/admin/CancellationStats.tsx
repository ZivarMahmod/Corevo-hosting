'use client'

import { useState } from 'react'
import styles from './CancellationStats.module.css'

type Bucket = { count: number; value: string }
type Period = 'today' | 'week' | 'month'

const TABS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Idag' },
  { key: 'week', label: 'Vecka' },
  { key: 'month', label: 'Månad' },
]

/**
 * Avbokningspanel med period-växlare (Idag/Vecka/Månad). Alla tre perioderna är
 * FÖRBERÄKNADE på servern (dashboardData.cancellationStats) och skickas in färdiga —
 * växlingen byter bara vilken som visas, ingen ny hämtning. Visar antal avbokningar
 * + förlorat värde (redan formaterat till "620 kr" server-side).
 */
export function CancellationStats({
  today,
  week,
  month,
}: {
  today: Bucket
  week: Bucket
  month: Bucket
}) {
  const [period, setPeriod] = useState<Period>('today')
  const cur = period === 'today' ? today : period === 'week' ? week : month

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={`num ${styles.kicker}`}>AVBOKNINGAR</span>
        <div className={styles.tabs} role="tablist" aria-label="Period">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={period === t.key}
              className={`${styles.tab} ${period === t.key ? styles.tabActive : ''}`}
              onClick={() => setPeriod(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.count}>
          <span className={`num ${styles.countNum}`}>{cur.count}</span>
          <span className={styles.countLabel}>
            {cur.count === 1 ? 'avbokning' : 'avbokningar'}
          </span>
        </div>
        <span className={`num ${styles.value}`}>{cur.value}</span>
      </div>
    </div>
  )
}
