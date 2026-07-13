import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ShopProductRow, ShopOrderRow, ShippingOptionRow } from './types'

/**
 * Kundens leveransval (goal-64) — inklusive de AVSTÄNGDA (admin ska se allt hen äger;
 * bara storefronten filtrerar på active). Tenant-scopat: .eq är den primära grinden,
 * RLS är defense-in-depth.
 */
export async function listShippingOptions(tenantId: string): Promise<ShippingOptionRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shop_shipping_options')
    .select('id,key,name,description,cost_cents,sort_order,active')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })
  return data ?? []
}

/**
 * Load all shop products for a tenant, ordered by sort_order then created_at.
 * Tenant-scoped: only rows where tenant_id = tenantId are returned (RLS is
 * defence-in-depth; the explicit .eq is the primary gate).
 */
export async function listShopProducts(tenantId: string): Promise<ShopProductRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shop_products')
    .select(
      // EN sträng-literal: Supabases typ-parser läser select-strängen statiskt, och en
      // uppbruten (+-konkatenerad) sträng gör hela raden otypad (GenericStringError).
      'id,name,slug,description,price_cents,currency,stock,image_asset_id,active,sort_order,created_at,updated_at,category,badge,compare_at_price_cents,price_from',
    )
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  return data ?? []
}

/**
 * Load the 100 most recent shop orders for a tenant.
 * Tenant-scoped. Payment status is read-only; the checkout rails are paused
 * so payment_status always reflects whatever the initial insert wrote.
 */
export async function listShopOrders(tenantId: string): Promise<ShopOrderRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shop_orders')
    .select(
      'id,customer_name,customer_email,customer_phone,fulfilment,status,payment_status,' +
        'total_cents,currency,note,ship_address,tracking_number,carrier,shipped_at,created_at,' +
        'shop_order_items(product_name,quantity,unit_price_cents)',
    )
    .eq('tenant_id', tenantId)
    // Transienta köp-räls-states (held/abandonerade) hör inte hemma i order-listan.
    .not('status', 'in', '("reserved","awaiting_payment","expired")')
    .order('created_at', { ascending: false })
    .limit(100)
  type Joined = Omit<ShopOrderRow, 'items'> & { shop_order_items: ShopOrderRow['items'] | null }
  const rows = (data ?? []) as unknown as Joined[]
  return rows.map(({ shop_order_items, ...rest }) => ({ ...rest, items: shop_order_items ?? [] }))
}
