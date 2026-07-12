'use server'

// Spar-väg (Sajtbyggare S2) — sanera → persistera, fail-closed, ingen deploy.
//
// Tar editor-output (region-redigeringar) → applySiteContentEdits (saneras +
// fail-closed) → upsertar settings.copy (text) + branding (bild/färg/font/logo) på
// tenant_settings, EXAKT samma kolumner/merge-seam som admin/actions.ts redan
// använder (build-once: wrappar, skriver inte om). Runtime läser dem direkt →
// ändringen är live utan deploy (precis som färg/font idag).
//
// Auth: samma fence som varje admin-mutation (requirePortal('admin') +
// getAdminTenant) + goal-21 RBAC (canWrite 'Branding', additiv-restriktiv) eftersom
// vägen skriver branding. Flag-gatad: SAJTBYGGARE_ENABLED av → vägrar (route är redan
// gatad, men en server-action kan anropas direkt → defense-in-depth).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant, revalidateTenant } from '@/lib/admin/tenant'
import { resolveRoleMatrix } from '@/lib/platform/roles-permissions'
import { canWrite } from '@/lib/platform/catalog-shared'
import type { Json } from '@corevo/db'
import { tenantSiteEditorEnabled } from '@/lib/tenant-data'
import { sajtbyggareEnabled } from './flag'
import { applySiteContentEdits, type SiteContentEdit } from './site-content-edit'
import type { RegionManifest } from './manifest/types'
import { SALVIA_REGION_MANIFEST } from './manifest/salvia'

/** Mallar editorn kan spara mot. S2 = salvia (övriga mallar = senare skivor, §9). */
const TEMPLATE_MANIFESTS: Record<string, RegionManifest> = {
  salvia: SALVIA_REGION_MANIFEST,
}

export type SaveSiteContentResult = { ok: true } | { ok: false; error: string }

/**
 * Spara en uppsättning region-redigeringar för den inloggade salongens egen sida.
 * @param templateKey  vilken mall (måste matcha tenantens tema; S2 = 'salvia')
 * @param edits        [{ regionKey, value }] från editorn (osanerat)
 */
export async function saveSiteContent(
  templateKey: string,
  edits: SiteContentEdit[],
): Promise<SaveSiteContentResult> {
  if (!sajtbyggareEnabled()) return { ok: false, error: 'Sajtbyggaren är inte aktiverad.' }

  const manifest = TEMPLATE_MANIFESTS[templateKey]
  if (!manifest) return { ok: false, error: `Okänd mall: ${templateKey}` }
  if (!Array.isArray(edits) || edits.length === 0) return { ok: false, error: 'Inga ändringar att spara.' }

  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { ok: false, error: 'Inget företag är kopplat till ditt konto.' }

  // goal-21 RBAC: vägen skriver branding → kräv Branding-write (additiv-restriktiv,
  // narrow-only; default salon_admin/super_admin behåller skriv → ingen regression).
  const supabase = await createClient()
  const roleMatrix = await resolveRoleMatrix(supabase)
  if (!canWrite(roleMatrix, user.roleName, 'Branding'))
    return { ok: false, error: 'Din roll har inte behörighet att redigera sidan.' }

  // Läs prev settings + branding (för region-granulär merge — klobbra inte andra fält).
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings, branding')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  // Per-tenant gate (default OFF): editorn är aktiverad per kund av plattformen
  // (tenant_settings.settings.sajtbyggare_enabled). Defense-in-depth — rutten gatar
  // redan, men en server-action kan anropas direkt. Återbrukar `existing`-läsningen
  // ovan (ingen extra query). Av → vägra spara.
  if (!tenantSiteEditorEnabled(existing?.settings))
    return { ok: false, error: 'Sajtbyggaren är inte aktiverad för det här företaget.' }

  const applied = applySiteContentEdits(
    manifest,
    (existing?.settings ?? {}) as Record<string, unknown>,
    (existing?.branding ?? {}) as Record<string, unknown>,
    edits,
  )
  if (!applied.ok) return { ok: false, error: applied.error } // fail-closed: skriv inget

  const { error } = await supabase
    .from('tenant_settings')
    .upsert(
      {
        tenant_id: tenant.id,
        settings: applied.settings as unknown as Json,
        branding: applied.branding as unknown as Json,
      },
      { onConflict: 'tenant_id' },
    )
  if (error) return { ok: false, error: 'Kunde inte spara. Försök igen.' }

  // Live utan deploy: invalidera den publika tenant-cachen → nästa render läser nytt.
  revalidateTenant(tenant.slug)
  revalidatePath('/admin/sajtbyggare')
  return { ok: true }
}
