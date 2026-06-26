import 'server-only'
import { createClient } from '@/lib/supabase/server'

// ── Kund order-läsning (webshop köp-räls, goal-49) ───────────────────────────
// SÄKERHET (två-lager, speglar bookings.ts): cross-tenant-isolering = shop_orders_rls
// (tenant_id = private.tenant_id()) är HÅRT staket; own-only = APP-LAGER-filter
// .eq('customer_id', customerId). customerId resolvas ur auth.uid() via getCustomerId
// (auth-länkad). Gäst-ordrar lagda utloggat länkas via email-hash och visas inte här
// (de får mejlbekräftelse) — additivt finlir senare. Transienta states (reserved/
// awaiting_payment/expired) döljs — bara riktiga ordrar visas.

export type KundOrderItem = { productName: string; quantity: number; unitPriceCents: number }
export type KundOrder = {
  id: string
  status: string
  totalCents: number
  currency: string
  createdAt: string
  fulfilment: string
  items: KundOrderItem[]
}

type OrderJoinRow = {
  id: string
  status: string
  total_cents: number
  currency: string
  created_at: string
  fulfilment: string
  shop_order_items: { product_name: string; quantity: number; unit_price_cents: number }[] | null
}

const SELECT =
  'id, status, total_cents, currency, created_at, fulfilment, ' +
  'shop_order_items(product_name, quantity, unit_price_cents)'

// Transienta hold-states göms i kund-vyn (de är inte "riktiga" beställningar än).
const HIDDEN = new Set(['reserved', 'awaiting_payment', 'expired'])
const ACTIVE = new Set(['pending', 'confirmed', 'ready'])

function map(r: OrderJoinRow): KundOrder {
  return {
    id: r.id,
    status: r.status,
    totalCents: r.total_cents,
    currency: r.currency,
    createdAt: r.created_at,
    fulfilment: r.fulfilment,
    items: (r.shop_order_items ?? []).map((it) => ({
      productName: it.product_name,
      quantity: it.quantity,
      unitPriceCents: it.unit_price_cents,
    })),
  }
}

export type MyOrders = { active: KundOrder[]; completed: KundOrder[]; cancelled: KundOrder[] }

/** All real orders belonging to the signed-in customer, bucketed. */
export async function getMyOrders(customerId: string | null): Promise<MyOrders> {
  if (!customerId) return { active: [], completed: [], cancelled: [] }
  const supabase = await createClient()
  const { data } = await supabase
    .from('shop_orders')
    .select(SELECT)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  const rows = ((data ?? []) as unknown as OrderJoinRow[]).filter((r) => !HIDDEN.has(r.status)).map(map)
  return {
    active: rows.filter((o) => ACTIVE.has(o.status)),
    completed: rows.filter((o) => o.status === 'completed'),
    cancelled: rows.filter((o) => o.status === 'cancelled'),
  }
}

/** A single order owned by the customer, or null (not found / not theirs). */
export async function getMyOrder(customerId: string | null, orderId: string): Promise<KundOrder | null> {
  if (!customerId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('shop_orders')
    .select(SELECT)
    .eq('id', orderId)
    .eq('customer_id', customerId)
    .maybeSingle()
  const row = data as unknown as OrderJoinRow | null
  return row ? map(row) : null
}
