import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated } from '@/lib/admin/modules'
import { createClient } from '@/lib/supabase/server'
import { getTenantDetail } from '@/lib/platform/tenants'
import { buildSiteSnapshot, deriveSiteScheduleHours, loadSiteRevisionState } from '@/lib/platform/site-revisions'
import { getVerticalCopy } from '@/components/storefront/vertical-copy'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { buildSiteEditorManifest, type EditorManifestKind } from '@/lib/platform/site-editor-manifest'
import { SidaStudioV2Lazy } from '@/components/platform/SidaStudioV2Lazy'
import { tenantStorefrontHost, tenantStorefrontUrl } from '@/lib/storefront-url'
import {
  DEFAULT_STOREFRONT_THEME,
  STOREFRONT_THEMES,
  type StorefrontTheme,
} from '@/lib/tenant-data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Redigera sidan · Adminpanel' }

type AdminSidaPageProps = {
  searchParams: Promise<{ flik?: string | string[] }>
}

export default async function AdminSidaPage({ searchParams }: AdminSidaPageProps) {
  const query = await searchParams
  const requestedTabId = Array.isArray(query.flik) ? query.flik[0] : query.flik
  const user = await requireAdminArea('sida')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Redigera sidan</h1>
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const supabase = await createClient()
  const [detail, revisionState, moduleStates, verticalCopy] = await Promise.all([
    getTenantDetail(tenant.id, supabase),
    loadSiteRevisionState(supabase, tenant.id),
    getAdminModuleStates(tenant.id),
    getVerticalCopy(tenant.verticalId),
  ])
  if (!detail) {
    return (
      <section className="portal-section">
        <h1>Redigera sidan</h1>
        <p className="prose">Kunde inte läsa företagets data. Försök igen.</p>
      </section>
    )
  }

  const publishedSnapshot = buildSiteSnapshot(detail)
  const effectiveSnapshot = revisionState.draft?.snapshot ?? publishedSnapshot
  const rawTheme = publishedSnapshot.settings.theme
  const storefrontTheme: StorefrontTheme = STOREFRONT_THEMES.includes(rawTheme as StorefrontTheme)
    ? rawTheme as StorefrontTheme
    : DEFAULT_STOREFRONT_THEME
  const manifestKind: EditorManifestKind = storefrontTheme === 'kalla' || storefrontTheme === 'snitt'
    ? storefrontTheme
    : 'generic'
  const defaults = resolveThemeContent(storefrontTheme, null, verticalCopy)
  const storefrontUrl = tenantStorefrontUrl(detail.tenant.slug, detail.primaryDomain)
    ?? '#'
  const storefrontHost = tenantStorefrontHost(detail.tenant.slug, detail.primaryDomain)
    ?? detail.tenant.slug
  const liveModules = [
    'shop', 'kurser', 'blogg', 'offert', 'presentkort', 'lojalitet', 'galleri',
  ].filter((key) => isModuleActivated(moduleStates, key))

  return (
    <SidaStudioV2Lazy
      tenantId={detail.tenant.id}
      effectiveSnapshot={effectiveSnapshot}
      publishedSnapshot={publishedSnapshot}
      draft={revisionState.draft}
      history={revisionState.history}
      previewPath={`/salong-preview/${detail.tenant.slug}`}
      storefrontHost={storefrontHost}
      storefrontUrl={storefrontUrl}
      isActive={detail.tenant.status === 'active'}
      initialTabId={requestedTabId}
      manifestData={buildSiteEditorManifest(manifestKind, defaults, storefrontTheme)}
      liveModules={liveModules}
      scheduleHours={deriveSiteScheduleHours(detail)}
    />
  )
}
