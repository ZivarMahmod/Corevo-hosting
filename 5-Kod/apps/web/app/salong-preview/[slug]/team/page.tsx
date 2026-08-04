import type { Metadata } from 'next'
import { TeamSection } from '@/components/storefront/team/TeamSection'
import { loadTeamMembers } from '@/lib/storefront/team/load-team'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import { branschBokning } from '@/lib/storefront/bransch-copy'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { loadPreviewPage, type PreviewPageProps } from '../preview-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Team', robots: { index: false } }

export default async function PreviewTeamPage(props: PreviewPageProps) {
  const { bundle, theme, copyMode } = await loadPreviewPage(props)
  const { tenant, settings } = bundle
  const members = await loadTeamMembers(tenant.id, tenant.slug)
  const View = themeModuleViews(theme).team

  let body
  if (View) {
    const copy = await getTenantCopy(bundle, theme, copyMode)
    const content = resolveThemeContent(theme, settings.branding, copy)
    body = <View members={members} content={content} tenantName={tenant.name} />
  } else {
    body = (
      <TeamSection
        members={members}
        ctaLabel={branschBokning(tenant.vertical_id).hosPrefix}
        pageHero
      />
    )
  }

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
      {body}
    </StorefrontShell>
  )
}
