import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getCustomerId } from '@/lib/kund/customer'
import { getMyOrders, type KundOrder } from '@/lib/kund/shop-orders'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import styles from '@/components/kund/kund.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mina beställningar' }

const STATUS_LABEL: Record<string, string> = {
  pending: 'Mottagen',
  confirmed: 'Bekräftad',
  ready: 'Klar att hämta',
  completed: 'Slutförd',
  cancelled: 'Avbruten',
}

function summary(o: KundOrder): string {
  const first = o.items[0]
  if (!first) return '—'
  const more = o.items.length - 1
  return more > 0 ? `${first.productName} + ${more} till` : `${first.productName} × ${first.quantity}`
}

function OrderRow({ o }: { o: KundOrder }) {
  return (
    <li className={styles.item}>
      <Link href={`/konto/bestallningar/${o.id}`} className={styles.link}>
        <span className={styles.main}>
          <strong>#{o.id.slice(0, 8)}</strong>
          <span className={styles.sub}>{summary(o)}</span>
        </span>
        <span className={styles.meta}>
          <span>{formatShopPrice(o.totalCents, o.currency)}</span>
          <span className={styles.badge}>{STATUS_LABEL[o.status] ?? o.status}</span>
        </span>
      </Link>
    </li>
  )
}

export default async function OrdersPage() {
  const user = await requirePortal('kund')
  const customerId = await getCustomerId(user.id, user.tenantId ?? '')
  const { active, completed, cancelled } = await getMyOrders(customerId)
  const empty = active.length + completed.length + cancelled.length === 0

  return (
    <section className="portal-section">
      <Link href="/konto" className={styles.back}>
        ← Mitt konto
      </Link>
      <h1>Mina beställningar</h1>

      {empty ? (
        <p className={styles.notice}>Du har inga beställningar än.</p>
      ) : (
        <>
          {active.length > 0 ? (
            <>
              <h2>Pågående</h2>
              <ul className={styles.list}>{active.map((o) => <OrderRow key={o.id} o={o} />)}</ul>
            </>
          ) : null}
          {completed.length > 0 ? (
            <>
              <h2>Tidigare</h2>
              <ul className={styles.list}>{completed.map((o) => <OrderRow key={o.id} o={o} />)}</ul>
            </>
          ) : null}
          {cancelled.length > 0 ? (
            <>
              <h2>Avbrutna</h2>
              <ul className={styles.list}>{cancelled.map((o) => <OrderRow key={o.id} o={o} />)}</ul>
            </>
          ) : null}
        </>
      )}
    </section>
  )
}
