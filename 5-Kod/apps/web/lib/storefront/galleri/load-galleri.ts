// Galleri-modul — SERVER data loader (goal-64). Hämtar kundens gallery_items (0057)
// via den anonyma publika klienten och joinar in bilden ur media_assets, precis som
// load-blogg.ts joinar in bloggens omslag. Modellerad ORDAGRANT på
// lib/storefront/blogg/load-blogg.ts.
//
// INTE 'server-only' by import convention: den använder den cookie-lösa anon-klienten
// (säker inuti unstable_cache) exakt som load-shop.ts / load-blogg.ts. Den anropas
// ändå bara från serverkomponenter.
//
// KRITISKT (samma stängsel som tenant-data.ts / tenant-modules.ts, ADR 01 §2):
// `anon`-rollen bär INGET tenant_id-claim, så RLS isolerar INTE tenants för den
// publika klienten. Varje query filtrerar på det upplösta tenant_id:t I APP-LAGRET
// (.eq('tenant_id', …)). RLS (0057) är djupförsvar — den kapar dessutom anon-läsning
// till active = true, men vi sätter active i app-lagret också, för tydlighet och
// paritet med shop-loaderns active-filter.
//
// GATINGEN ÄR ANROPARENS JOBB: loadern kollar inte modul-state. /galleri löser
// tenant_modules.state via getTenantModuleStates() och 404:ar när galleri varken är
// live eller paused — samma form som blogg-gaten. En off/draft-modul når aldrig hit.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import type { GalleriData, GalleryItem } from './types'

/**
 * Ladda kundens galleri. Cachas per tenant och taggas med SAMMA `tenant:<slug>`-tagg
 * som resten av storefronten, så en bild som läggs till/tas bort i kundkortet (som
 * bustar den taggen) slår igenom här direkt i stället för att ligga kvar i 300 s.
 *
 * Returnerar null när kunden inte har någon galleri-modulrad alls (inget att rendera).
 * Returnerar { items: [] } när modulen finns men är tom — ett GILTIGT svar: sidan visar
 * ett ärligt tomtillstånd i stället för att hitta på bilder.
 */
export async function loadGalleriData(tenantId: string, slug: string): Promise<GalleriData | null> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<GalleriData | null> => {
      const supabase = createPublicClient()

      // Galleri-modulens per-tenant-rad. Ingen rad → null (kunden har aldrig fått modulen).
      const { data: moduleRow, error: modErr } = await supabase
        .from('tenant_modules')
        .select('config')
        .eq('tenant_id', tenantId) // app-lagrets tenant-isolering (RLS gör det INTE för anon)
        .eq('module_key', 'galleri')
        .maybeSingle()
      if (modErr || !moduleRow) return null

      // Aktiva bilder för denna kund, i kundens egen ordning, joinade mot sitt foto.
      const { data: rows } = await supabase
        .from('gallery_items')
        .select('id, caption, tag, year_label, aspect_ratio, media_assets(url, alt)')
        .eq('tenant_id', tenantId) // app-lagrets tenant-isolering (RLS gör det INTE för anon)
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      const items: GalleryItem[] = (
        (rows ?? []) as unknown as {
          id: string
          caption: string | null
          tag: string | null
          year_label: string | null
          aspect_ratio: string | null
          media_assets: { url: string; alt: string | null } | { url: string; alt: string | null }[] | null
        }[]
      ).map((r) => {
        // Supabase typar den inbäddade relationen som objekt ELLER array beroende på
        // FK-kardinaliteten; normalisera defensivt till en enda asset (samma rad som
        // load-blogg.ts gör för omslaget).
        const asset = Array.isArray(r.media_assets) ? r.media_assets[0] : r.media_assets
        return {
          id: r.id,
          imageUrl: asset?.url ?? null,
          imageAlt: asset?.alt ?? null,
          caption: r.caption ?? null,
          tag: r.tag ?? null,
          yearLabel: r.year_label ?? null,
          aspectRatio: r.aspect_ratio ?? null,
        }
      })

      return { items }
    },
    ['galleri-data-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
