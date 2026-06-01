import type { Metadata } from 'next'
import Link from 'next/link'
import { billingUnderlag } from '@/lib/platform/metrics'
import { BILLING_MODEL_LABELS, formatPrice, type BillingModel } from '@/lib/platform/billing'
import styles from '@/components/platform/platform.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Fakturering' }

const MONTHS_SV = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
]

function clampMonth(y: number, m: number): { year: number; month: number } {
  if (m < 1) return { year: y - 1, month: 12 }
  if (m > 12) return { year: y + 1, month: 1 }
  return { year: y, month: m }
}

export default async function FaktureringPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  const year = Number(sp.year) || now.getUTCFullYear()
  const month = Number(sp.month) || now.getUTCMonth() + 1

  const { rows, totalCents } = await billingUnderlag(year, month)
  const prev = clampMonth(year, month - 1)
  const next = clampMonth(year, month + 1)
  const label = `${MONTHS_SV[month - 1]} ${year}`

  return (
    <section className="portal-section">
      <h1>Faktureringsunderlag</h1>
      <p className="prose">
        FLÖDE 2 — läs-vy som Corevo fakturerar manuellt från. Per salong per kalendermånad:
        genomförda bokningar (exkl. avbokade/uteblivna) × avgift, eller fast månadsbelopp. Ingen
        Stripe-koppling.
      </p>

      <div className={styles.filters}>
        <Link href={`/fakturering?year=${prev.year}&month=${prev.month}`} className={styles.btn}>
          ← {MONTHS_SV[prev.month - 1]}
        </Link>
        <strong style={{ alignSelf: 'center', textTransform: 'capitalize' }}>{label}</strong>
        <Link href={`/fakturering?year=${next.year}&month=${next.month}`} className={styles.btn}>
          {MONTHS_SV[next.month - 1]} →
        </Link>
      </div>

      <table className="portal-table">
        <thead>
          <tr>
            <th>Salong</th>
            <th>Prismodell</th>
            <th className={styles.right}>Genomförda</th>
            <th className={styles.right}>Avgift</th>
            <th className={styles.right}>Underlag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tenantId}>
              <td>
                <Link href={`/salonger/${r.tenantId}`}>
                  <code className={styles.code}>{r.slug}</code>
                </Link>{' '}
                {r.name}
              </td>
              <td>{BILLING_MODEL_LABELS[r.billingModel as BillingModel] ?? r.billingModel}</td>
              <td className={styles.right}>{r.completedBookings}</td>
              <td className={styles.right}>
                {r.billingModel === 'flat_monthly'
                  ? `${formatPrice(r.flatMonthlyFeeCents)}/mån`
                  : `${formatPrice(r.perBookingFeeCents)}/bokn.`}
              </td>
              <td className={`${styles.right}`} style={{ fontWeight: 700 }}>
                {formatPrice(r.feeCents)}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.muted}>
                Inga salonger att fakturera för {label}.{' '}
                <Link href="/salonger/ny">Skapa en salong →</Link>
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className={styles.right} style={{ fontWeight: 700 }}>
              Totalt underlag {label}
            </td>
            <td className={styles.right} style={{ fontWeight: 800 }}>
              {formatPrice(totalCents)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className={styles.hint}>
        Startavgift (engångs) faktureras separat per salong och ingår inte i månadsunderlaget ovan.
      </p>
    </section>
  )
}
