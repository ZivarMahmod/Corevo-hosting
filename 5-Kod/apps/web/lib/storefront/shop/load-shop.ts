// Webshop-modul — SERVER data loader. Fetches the tenant's shop config (from
// tenant_modules.config) + its active products via the anonymous public client,
// shaping them for ShopSection. Modeled on lib/storefront/skin/load-shop.ts and
// lib/tenant-modules.ts.
//
// NOT a 'server-only' module by import convention: it uses the cookie-less anon
// public client (safe inside unstable_cache) exactly like tenant-modules.ts. It
// is still only ever called from server components.
//
// CRITICAL (same fence as tenant-data.ts / tenant-modules.ts, ADR 01 §2): the
// `anon` role carries NO tenant_id claim, so RLS does NOT isolate tenants for the
// public client. Every query filters by the resolved tenant_id IN THE APP LAYER
// (.eq('tenant_id', …)). RLS (0032) is defense-in-depth only.
//
// GATING IS THE CALLER'S JOB: this loader does not check module state. The
// storefront resolves tenant_modules.state via getTenantModuleStates() and only
// renders ShopSection when shop === 'live' (same shape as the booking gate in
// app/(public)/layout.tsx). A draft/off/paused shop never reaches loadShopData.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { parseShopConfig, type ShopConfig, type ShopData, type ShopProduct } from './types'

/** Max products pulled for the storefront listing (keeps the section bounded;
 *  a full paginated catalog is a later concern, not needed for the gate/variant). */
const PRODUCT_LIMIT = 60

/**
 * Load the tenant's shop config + active products. Cached per-tenant and tagged
 * with the SAME `tenant:<slug>` tag the rest of the storefront uses, so a config
 * change (variant swap) or product edit that busts that tag refreshes here too.
 *
 * Returns null when the tenant has no shop module row at all (nothing to render).
 * Returns a ShopData with an empty product list when the shop is configured but
 * has no products yet (the section then shows an honest "snart"-state).
 */
export async function loadShopData(tenantId: string, slug: string): Promise<ShopData | null> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<ShopData | null> => {
      const supabase = createPublicClient()

      // The shop module's per-tenant config (variant + params). No row → null.
      const { data: moduleRow, error: modErr } = await supabase
        .from('tenant_modules')
        .select('config')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('module_key', 'shop')
        .maybeSingle()
      if (modErr || !moduleRow) return null

      const config: ShopConfig = parseShopConfig(moduleRow.config)

      // Active products for this tenant, joined to their media asset for the image.
      const { data: rows } = await supabase
        .from('shop_products')
        .select('id, name, description, price_cents, currency, stock, media_assets(url, alt)')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .limit(PRODUCT_LIMIT)

      const products: ShopProduct[] = (rows ?? []).map((r) => {
        // Supabase types the embedded relation as object | array depending on the
        // FK cardinality; normalize to a single asset defensively.
        const asset = Array.isArray(r.media_assets) ? r.media_assets[0] : r.media_assets
        return {
          id: r.id,
          name: r.name,
          description: r.description ?? null,
          priceCents: r.price_cents ?? 0,
          currency: r.currency ?? config.currency,
          stock: r.stock ?? null,
          imageUrl: asset?.url ?? null,
          imageAlt: asset?.alt ?? null,
        }
      })

      return { config, products }
    },
    ['shop-data-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
