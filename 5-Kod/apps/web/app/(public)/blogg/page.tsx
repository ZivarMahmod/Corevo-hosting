import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { BloggSection } from '@/components/storefront/BloggSection'
import { pageMetadata } from '@/components/storefront/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('blogg')
}

/** Bloggens EGEN sida — alla inlägg. Startsidan visar bara de 3 senaste. */
export default async function BloggPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'blogg')
  if (!isModuleLive(states, 'blogg') && !paused) notFound()

  return <BloggSection tenantId={tenant.id} slug={tenant.slug} paused={paused} />
}
