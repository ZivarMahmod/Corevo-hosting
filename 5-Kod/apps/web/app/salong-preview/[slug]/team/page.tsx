import type { Metadata } from 'next'
import { TeamSection } from '@/components/storefront/team/TeamSection'
import { loadTeamMembers } from '@/lib/storefront/team/load-team'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { branschBokning } from '@/components/storefront/bransch-copy'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell } from '../preview-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Team', robots: { index: false } }

export default async function PreviewTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string }>
}) {
  const { slug } = await params
  const { theme: themeParam } = await searchParams
  const bundle = await loadPreviewBundle(slug)
  const theme = resolvePreviewTheme(bundle, themeParam)
  const { tenant, settings } = bundle
  const members = await loadTeamMembers(tenant.id, tenant.slug)
  const View = themeModuleViews(theme).team

  let body
  if (View) {
    const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme)
    const content = resolveThemeContent(theme, settings.branding, copy)
    body = <View members={members} content={content} tenantName={tenant.name} />
  } else {
    body = <TeamSection members={members} ctaLabel={branschBokning(tenant.vertical_id).hosPrefix} pageHero />
  }

  return <PreviewShell bundle={bundle} theme={theme}>{body}</PreviewShell>
}
