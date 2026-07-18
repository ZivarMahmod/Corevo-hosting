import type { KundBooking } from '@/lib/kund/bookings'
import { Icon } from '@/components/portal/ui'
import styles from './account.module.css'

/**
 * DIN VANLIGA (§4.8) — smart-rebook nudge derived from the customer's OWN booking
 * history: their most-frequent service, the typical interval between visits, and
 * the last visit date → "Du brukar boka var N:e vecka · senast {date}. Dags
 * snart?" + "Boka din vanliga".
 *
 * Fully derived, never faked. If the cadence isn't derivable (fewer than 2 dated
 * visits) the card renders nothing — the page falls back to the generic "Boka ny
 * tid" path in MINA BOKNINGAR, so the customer is never shown a fabricated habit.
 */

type Derived = { service: string; serviceId: string; cadenceWeeks: number; lastVisit: string }

/** Pure: derive the habitual service + visit cadence from booking history.
 *  `bookings` = the customer's bookings; only completed visits may establish a habit.
 *  service to find the dominant service and the median gap between consecutive
 *  visits of that service. Returns null when not derivable. */
export function deriveUsual(bookings: KundBooking[], timeZone: string): Derived | null {
  // Count services; pick the most-booked (ties → most recent wins via order).
  const byService = new Map<string, { name: string; serviceId: string; times: number[] }>()
  for (const b of bookings) {
    if (b.status !== 'completed') continue
    if (!b.serviceId) continue
    const t = new Date(b.startTs).getTime()
    if (!Number.isFinite(t)) continue
    const cur = byService.get(b.serviceId)
    if (cur) cur.times.push(t)
    else
      byService.set(b.serviceId, {
        name: b.serviceName ?? 'din vanliga tjänst',
        serviceId: b.serviceId,
        times: [t],
      })
  }
  let best: { name: string; serviceId: string; times: number[] } | null = null
  for (const v of byService.values()) {
    if (!best || v.times.length > best.times.length) best = v
  }
  if (!best || best.times.length < 2) return null

  const sorted = [...best.times].sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i]! - sorted[i - 1]!)
  gaps.sort((a, b) => a - b)
  const medianMs = gaps[Math.floor(gaps.length / 2)]!
  const cadenceWeeks = Math.max(1, Math.round(medianMs / (7 * 24 * 60 * 60 * 1000)))

  const last = new Date(sorted[sorted.length - 1]!)
  const lastVisit = new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(last)

  return { service: best.name, serviceId: best.serviceId, cadenceWeeks, lastVisit }
}

export function UsualCard({ bookings, timeZone }: { bookings: KundBooking[]; timeZone: string }) {
  const usual = deriveUsual(bookings, timeZone)
  if (!usual) return null

  return (
    <section className={styles.usual}>
      <div className={styles.usualIcon} aria-hidden>
        <Icon name="repeat" size={22} />
      </div>
      <div className={styles.usualBody}>
        <div className={styles.sectionEyebrow}>Din vanliga</div>
        <div className={styles.usualTitle}>{usual.service}</div>
        <div className={styles.usualSub}>
          Du brukar boka var {usual.cadenceWeeks}:e vecka · senast {usual.lastVisit}. Dags snart?
        </div>
      </div>
      <a href={`/boka?service=${usual.serviceId}`} className={styles.btn}>
        Boka din vanliga
      </a>
    </section>
  )
}
