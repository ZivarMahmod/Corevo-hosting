import { notFound } from 'next/navigation'
import { requirePortal } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import {
  getTenantBySlug,
  STOREFRONT_THEMES,
  type StorefrontTheme,
  type TenantBundle,
} from '@/lib/tenant-data'

/** Shared URL policy and tenant authorization for storefront preview routes. */
export function resolvePreviewTheme(
  bundle: TenantBundle,
  themeParam: string | undefined,
): StorefrontTheme {
  return typeof themeParam === 'string' &&
    (STOREFRONT_THEMES as readonly string[]).includes(themeParam)
    ? (themeParam as StorefrontTheme)
    : bundle.settings.theme
}

export type PreviewCopyMode = 'keep' | 'template' | null

export function resolvePreviewCopyMode(copyParam: string | undefined): PreviewCopyMode {
  return copyParam === 'keep' || copyParam === 'template' ? copyParam : null
}

export type PreviewPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string; copy?: string }>
}

export async function loadPreviewPage<
  Params extends { slug: string },
  SearchParams extends { theme?: string; copy?: string },
>({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams])
  const bundle = await loadPreviewBundle(resolvedParams.slug)
  return {
    params: resolvedParams,
    searchParams: resolvedSearchParams,
    bundle,
    theme: resolvePreviewTheme(bundle, resolvedSearchParams.theme),
    copyMode: resolvePreviewCopyMode(resolvedSearchParams.copy),
  }
}

/** goal-61 preview-parity: ärligt besked när en modulsida previewas men modulen är AV —
 *  den skarpa sidan hade gett 404, men i editorn är "varför ser jag inget?" en fråga
 *  som förtjänar ett svar, inte en krasch-sida. */
export function PreviewModuleOff({ moduleLabel }: { moduleLabel: string }) {
  return (
    <section className="section">
      <div className="section-inner" style={{ textAlign: 'center', padding: '64px 0' }}>
        <p role="status" style={{ font: '600 15px/1.5 var(--font-ui)', margin: 0 }}>
          Modulen {moduleLabel} är inte påslagen för den här kunden.
        </p>
        <p style={{ font: '400 13px/1.5 var(--font-ui)', opacity: 0.75, margin: '8px 0 0' }}>
          Slå på den under Drift-fliken så visas sidan här och på den publika sajten.
        </p>
      </div>
    </section>
  )
}

export async function loadPreviewBundle(slug: string): Promise<TenantBundle> {
  // Same-origin iframe → the viewer's session cookie flows. Platform admin may
  // preview ANY tenant; a salon admin (portal level) only their OWN slug — the
  // kund-adminens /admin/sida uses exactly this route for its live preview.
  const user = await requirePortal('admin')
  if (user.partnerAdmin) {
    const supabase = await createClient()
    const { data: scoped } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!scoped) notFound()
  } else if (!user.platformAdmin) {
    const supabase = await createClient()
    const { data: own } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', user.tenantId ?? '')
      .maybeSingle()
    if (!own || own.slug !== slug) notFound()
  }
  const bundle = await getTenantBySlug(slug)
  if (!bundle) notFound() // unknown / suspended (public client sees active only)
  return bundle
}
