// LEVERANSVALEN — server-loader (goal-64).
//
// Alla 12 Claude Design-paket har ett leveranssteg där kunden VÄLJER, och valet bär
// ett pris ("Bud samma dag 79 kr" · "Hämta i studion — Fritt"). Motorn hade EN
// fulfilment-variant per butik (kunden valde ingenting) och shop_orders.shipping_cents
// sattes alltid 0 — totalen var alltså osann så fort designen visade en fraktrad.
//
// Det här är ett LAGER OVANPÅ fulfilment, inte en ersättning: `fulfilment` styr
// fortfarande butikens LÖFTESTEXT ("Vi postar hem din beställning") och köp-CTA:ns
// ord. Leveransvalen är vad kunden faktiskt kan välja i kassan.
//
// Samma fence som resten av storefronten (ADR 01 §2): anon-rollen bär inget tenant-
// claim, så RLS isolerar INTE tenants för den publika klienten. Varje query filtrerar
// på tenant_id i APP-LAGRET. RLS (0057) är defense-in-depth.
//
// PRISET LÄSES ALDRIG FRÅN KLIENTEN: den här loadern matar bara VYN. När ordern
// bekräftas slår confirm_shop_order (0058) upp kostnaden ur DB på nytt utifrån det
// valda id:t. En manipulerad klient kan alltså på sin höjd ljuga för sig själv.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import type { ShippingOption } from './types'

/**
 * Kundens aktiva leveransval, i deras egen ordning. Tom lista = butiken har inte lagt
 * upp några → kassan visar inget val-steg och frakten är 0 (dagens beteende, oförändrat
 * för alla befintliga butiker).
 */
export async function loadShippingOptions(tenantId: string, slug: string): Promise<ShippingOption[]> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<ShippingOption[]> => {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('shop_shipping_options')
        .select('id, key, name, description, cost_cents')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS gör det INTE för anon)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      return (data ?? []).map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description ?? null,
        costCents: r.cost_cents ?? 0,
      }))
    },
    ['shop-shipping-options', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 }, // samma tagg som resten → admin-ändring slår igenom direkt
  )
  return load()
}
