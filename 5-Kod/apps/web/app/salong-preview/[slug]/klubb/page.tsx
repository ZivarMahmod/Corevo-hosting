import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { LojalitetPage } from '@/components/storefront/lojalitet/LojalitetPage'
import { loadLojalitetData } from '@/lib/storefront/lojalitet/load-lojalitet'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { loadPreviewPage, PreviewModuleOff, type PreviewPageProps } from '../preview-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Klubben', robots: { index: false } }

export default async function PreviewKlubbPage(props: PreviewPageProps) {
  const { bundle, theme, copyMode } = await loadPreviewPage(props)
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const off = !isModuleLive(states, 'lojalitet')
  const data = off ? null : await loadLojalitetData(tenant.id, tenant.slug)
  const View = themeModuleViews(theme).lojalitet

  let body
  if (off || !data) {
    body = <PreviewModuleOff moduleLabel="Klubben" />
  } else if (View) {
    const copy = await getTenantCopy(bundle, theme, copyMode)
    const content = resolveThemeContent(theme, settings.branding, copy)
    body = (
      <View config={data.config} plans={data.plans} content={content} tenantName={tenant.name} />
    )
  } else {
    body = <LojalitetPage config={data.config} plans={data.plans} />
  }

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
      {body}
    </StorefrontShell>
  )
}
