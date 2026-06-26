import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePortal } from '@/lib/auth/session'
import { getCustomerId } from '@/lib/kund/customer'
import { getMyOrder } from '@/lib/kund/shop-orders'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import styles from '@/components/kund/kund.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Beställning' }

const STATUS_LABEL: Record<string, string> = {
  pending: 'Mottagen',
  confirmed: 'Bekräftad',
  ready: 'Klar att hämta',
  completed: 'Slutförd',
  cancelled: 'Avbruten',
}
const FULFILMENT_LABEL: Record<string, string> = {
  ship: 'Posta hem',
  pickup_within_days: 'Hämta i butik',
  order_in_then_pickup: 'Beställ hem till butik',
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePortal('kund')
  const customerId = await getCustomerId(user.id, user.tenantId ?? '')
  const order = await getMyOrder(customerId, id)
  if (!order) notFound()

  return (
    <section className="portal-section">
      <Link href="/konto/bestallningar" className={styles.back}>
        ← Mina beställningar
      </Link>
      <h1>Beställning #{order.id.slice(0, 8)}</h1>

      <div className={styles.detail}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Status</span>
          <span>{STATUS_LABEL[order.status] ?? order.status}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Leverans</span>
          <span>{FULFILMENT_LABEL[order.fulfilment] ?? order.fulfilment}</span>
        </div>
        {order.items.map((it, i) => (
          <div key={i} className={styles.detailRow}>
            <span className={styles.detailLabel}>
              {it.productName} × {it.quantity}
            </span>
            <span>{formatShopPrice(it.unitPriceCents * it.quantity, order.currency)}</span>
          </div>
        ))}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Totalt</span>
          <span>
            <strong>{formatShopPrice(order.totalCents, order.currency)}</strong>
          </span>
        </div>
      </div>
    </section>
  )
}
