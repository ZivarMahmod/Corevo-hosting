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
// app/(public)/layout.tsx). Off/draft når aldrig loadern; paused laddas som stängd katalog.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { commerceReleaseGate } from '@/lib/release/commerce'
import { parseShopConfig, type ShopConfig, type ShopData, type ShopProduct, type ShopVariant } from './types'

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
export async function loadShopData(
  tenantId: string,
  slug: string,
  /**
   * goal-64: vald kategori ur `/shop?kategori=Rosor`. Filtreringen sker SERVER-side (chipsen
   * är <Link>-taggar, inte klient-state → de fungerar utan JS och kan indexeras).
   * undefined/null/okänd kategori → hela sortimentet, aldrig en krasch.
   */
  category?: string | null,
): Promise<ShopData | null> {
  if (!commerceReleaseGate(tenantId).shop) return null
  const all = await loadAllShopData(tenantId, slug)
  if (!all) return null

  // Ingen vald kategori → allt. En okänd kategori (t.ex. gammal länk eller manipulerad
  // query) ger en TOM lista, inte ett fel: butiken visas, den är bara tom för det filtret.
  const wanted = category?.trim() || null
  if (!wanted) return all
  return {
    ...all,
    // categories är MEDVETET hela sortimentets lista — chip-raden ska stå kvar när man filtrerar.
    products: all.products.filter((p) => p.category === wanted),
    activeCategory: wanted,
  }
}

/** Hela sortimentet + configen, cachat per tenant. Filtret läggs ovanpå (utanför cachen) —
 *  annars skulle varje kategori spränga en egen cache-post för samma data. */
async function loadAllShopData(tenantId: string, slug: string): Promise<ShopData | null> {
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
        // OBS: EN sammanhängande sträng-literal. Supabases typ-parser läser select-strängen
        // statiskt — bryts den upp med + faller hela raden tillbaka till GenericStringError.
        .select(
          'id, name, description, price_cents, currency, stock, category, badge, compare_at_price_cents, price_from, media_assets(url, alt)',
        )
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .limit(PRODUCT_LIMIT)

      const productIds = (rows ?? []).map((r) => r.id)

      // Köpbara varianter (0042): pris/lager/bild per variant. available = stock −
      // reserved_qty (held av pågående ordrar). Grupperas per produkt nedan.
      const variantsByProduct = new Map<string, ShopVariant[]>()
      if (productIds.length > 0) {
        const { data: vRows } = await supabase
          .from('shop_product_variants')
          .select('id, product_id, name, price_cents, currency, stock, reserved_qty, media_assets(url)')
          .eq('tenant_id', tenantId) // app-layer tenant isolation
          .eq('active', true)
          .in('product_id', productIds)
          .order('sort_order', { ascending: true })
        for (const v of vRows ?? []) {
          const asset = Array.isArray(v.media_assets) ? v.media_assets[0] : v.media_assets
          const list = variantsByProduct.get(v.product_id) ?? []
          list.push({
            id: v.id,
            name: v.name,
            priceCents: v.price_cents ?? 0,
            currency: v.currency ?? config.currency,
            available: v.stock == null ? null : Math.max(0, v.stock - (v.reserved_qty ?? 0)),
            imageUrl: asset?.url ?? null,
          })
          variantsByProduct.set(v.product_id, list)
        }
      }

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
          variants: variantsByProduct.get(r.id) ?? [],
          // goal-64 (0057): render-on-present — tom sträng blir null, aldrig ett tomt märke.
          category: r.category?.trim() || null,
          badge: r.badge?.trim() || null,
          compareAtPriceCents: r.compare_at_price_cents ?? null,
          priceFrom: r.price_from === true,
        }
      })

      // Kategorierna HÄRLEDS ur kundens faktiska sortiment — de listas inte någonstans.
      // Har ingen produkt en kategori blir listan tom → mallen renderar noll chips. Det är
      // meningen: hellre ingen chip-rad än en påhittad ("Rosor" i en salong som säljer schampo).
      const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))].sort(
        (a, b) => a.localeCompare(b, 'sv'),
      )

      return { config, products, categories, activeCategory: null }
    },
    ['shop-data-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}

/** Allt produktdetaljsidan behöver: den resolvade shop-configen + EN produkt. */
export type ShopProductData = {
  config: ShopConfig
  product: ShopProduct
}

/**
 * Load ONE active product for the tenant (produktdetaljsidan, goal-54 S4).
 * Samma select/mappning som list-loadern ovan, samma cache-tagg (`tenant:<slug>`)
 * så produkt-/config-ändringar bustar även detaljsidan. Okänd/inaktiv produkt
 * eller saknad shop-modul → null (sidan svarar med notFound).
 */
export async function loadShopProduct(
  tenantId: string,
  slug: string,
  productId: string,
): Promise<ShopProductData | null> {
  if (!commerceReleaseGate(tenantId).shop) return null
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<ShopProductData | null> => {
      const supabase = createPublicClient()

      const { data: moduleRow, error: modErr } = await supabase
        .from('tenant_modules')
        .select('config')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('module_key', 'shop')
        .maybeSingle()
      if (modErr || !moduleRow) return null

      const config: ShopConfig = parseShopConfig(moduleRow.config)

      const { data: r } = await supabase
        .from('shop_products')
        // OBS: EN sammanhängande sträng-literal. Supabases typ-parser läser select-strängen
        // statiskt — bryts den upp med + faller hela raden tillbaka till GenericStringError.
        .select(
          'id, name, description, price_cents, currency, stock, category, badge, compare_at_price_cents, price_from, media_assets(url, alt)',
        )
        .eq('tenant_id', tenantId) // app-layer tenant isolation
        .eq('id', productId)
        .eq('active', true)
        .maybeSingle()
      if (!r) return null

      const variants: ShopVariant[] = []
      const { data: vRows } = await supabase
        .from('shop_product_variants')
        .select('id, product_id, name, price_cents, currency, stock, reserved_qty, media_assets(url)')
        .eq('tenant_id', tenantId) // app-layer tenant isolation
        .eq('active', true)
        .eq('product_id', r.id)
        .order('sort_order', { ascending: true })
      for (const v of vRows ?? []) {
        const asset = Array.isArray(v.media_assets) ? v.media_assets[0] : v.media_assets
        variants.push({
          id: v.id,
          name: v.name,
          priceCents: v.price_cents ?? 0,
          currency: v.currency ?? config.currency,
          available: v.stock == null ? null : Math.max(0, v.stock - (v.reserved_qty ?? 0)),
          imageUrl: asset?.url ?? null,
        })
      }

      const asset = Array.isArray(r.media_assets) ? r.media_assets[0] : r.media_assets
      const product: ShopProduct = {
        id: r.id,
        name: r.name,
        description: r.description ?? null,
        priceCents: r.price_cents ?? 0,
        currency: r.currency ?? config.currency,
        stock: r.stock ?? null,
        imageUrl: asset?.url ?? null,
        imageAlt: asset?.alt ?? null,
        variants,
        // goal-64 (0057): samma fält som list-loadern — produktsidan får inte tappa badgen.
        category: r.category?.trim() || null,
        badge: r.badge?.trim() || null,
        compareAtPriceCents: r.compare_at_price_cents ?? null,
        priceFrom: r.price_from === true,
      }

      return { config, product }
    },
    ['shop-product-by-id', tenantId, norm, productId],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
