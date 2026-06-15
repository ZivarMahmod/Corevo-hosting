import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ShopProductRow, ShopOrderRow } from './types'

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
      'id,name,slug,description,price_cents,currency,stock,image_asset_id,active,sort_order,created_at,updated_at',
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
      'id,customer_name,customer_email,customer_phone,fulfilment,status,payment_status,total_cents,currency,note,created_at',
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100)
  return data ?? []
}
