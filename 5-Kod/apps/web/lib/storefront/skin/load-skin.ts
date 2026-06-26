// Template-skin resolver — SERVER data loader. Fetches the rows the pure resolver
// needs (template + slot declarations + tenant values + media) via the anonymous
// public client, then hands them to resolveSkin(). Modeled on lib/tenant-data.ts.
//
// NOT YET WIRED: nothing in the storefront imports this yet. boka/page.tsx (the
// natural call site) is on a dirty branch, so wiring is a deliberate follow-up.
// This module is additive and INERT until something calls loadTenantSkin() — it
// performs no work at import time and has no side effects.
//
// CRITICAL (same rule as tenant-data.ts / ADR 01 §2): the `anon` role has NO
// tenant_id claim, so RLS does NOT isolate one tenant from another. content_slots
// and media_assets are filtered by tenant_id IN THE APP LAYER (.eq('tenant_id', …)).
// templates / template_slots are tenant-agnostic catalog rows (no tenant_id column),
// scoped by key only.

import type { Tables } from '@corevo/db'
import { createPublicClient } from '@/lib/supabase/public'
import { resolveSkin } from './resolve'
import type { ResolvedSkin } from './types'

/**
 * Load + resolve the skin for one tenant on one template.
 *
 * Fetches, in parallel:
 *  - the template row (by key, status='active') — returns null if missing.
 *  - its template_slots (slot declarations, by template_key).
 *  - the tenant's content_slots (values) — by tenant_id AND template_key (both
 *    .eq(); app-layer tenant isolation — RLS does NOT scope anon).
 *  - the tenant's media_assets (by tenant_id; app-layer scope) for asset resolution.
 *
 * Then delegates to the pure resolveSkin(). Empty slot/content/media tables (the
 * prod reality today) resolve to an empty-but-valid skin. Returns null only when
 * the template itself is missing/inactive.
 */
export async function loadTenantSkin(
  tenantId: string,
  templateKey: string,
): Promise<ResolvedSkin | null> {
  const supabase = createPublicClient()

  const { data: template, error } = await supabase
    .from('templates')
    .select('*')
    .eq('key', templateKey)
    .eq('status', 'active')
    .maybeSingle()
  if (error || !template) return null

  // Fetch the three remaining inputs in PARALLEL (they are independent; this runs on
  // the public storefront hot path, so avoid sequential round-trips):
  //  - template_slots: slot declarations (tenant-agnostic catalog; key-scoped).
  //  - content_slots:  tenant VALUES, scoped by BOTH tenant_id and template_key
  //                    (tenant_id is the app-layer isolation filter — RLS does NOT
  //                    scope anon).
  //  - media_assets:   tenant media for asset resolution; scoped by tenant_id.
  const [{ data: templateSlots }, { data: contentSlots }, { data: mediaAssets }] = await Promise.all([
    supabase
      .from('template_slots')
      .select('*')
      .eq('template_key', templateKey)
      .order('sort_order', { ascending: true }),
    supabase
      .from('content_slots')
      .select('*')
      .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
      .eq('template_key', templateKey),
    supabase
      .from('media_assets')
      .select('*')
      .eq('tenant_id', tenantId), // app-layer tenant isolation (RLS does NOT do this for anon)
  ])

  return resolveSkin(
    template,
    (templateSlots ?? []) as Tables<'template_slots'>[],
    (contentSlots ?? []) as Tables<'content_slots'>[],
    (mediaAssets ?? []) as Tables<'media_assets'>[],
  )
}
