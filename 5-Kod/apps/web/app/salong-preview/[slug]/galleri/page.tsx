import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { GalleriSection } from '@/components/storefront/galleri/GalleriSection'
import { loadGalleriData } from '@/lib/storefront/galleri/load-galleri'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { loadPreviewPage, PreviewModuleOff, type PreviewPageProps } from '../preview-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Galleri', robots: { index: false } }

export default async function PreviewGalleriPage(props: PreviewPageProps) {
  const { bundle, theme, copyMode } = await loadPreviewPage(props)
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const off = !isModuleLive(states, 'galleri')
  const View = themeModuleViews(theme).galleri

  let body
  if (off) {
    body = <PreviewModuleOff moduleLabel="Galleri" />
  } else if (View) {
    const data = await loadGalleriData(tenant.id, tenant.slug)
    const copy = await getTenantCopy(bundle, theme, copyMode)
    const content = resolveThemeContent(theme, settings.branding, copy)
    body = <View items={data?.items ?? []} content={content} tenantName={tenant.name} />
  } else {
    body = <GalleriSection tenantId={tenant.id} slug={tenant.slug} pageHero />
  }

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
      {body}
    </StorefrontShell>
  )
}
