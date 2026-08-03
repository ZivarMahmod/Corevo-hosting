import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated, moduleAdminConfig, moduleAdminState } from '@/lib/admin/modules'
import { listBlogPosts } from '@/lib/admin/blogg/data'
import { listMediaAssets } from '@/lib/admin/media/data'
import { BloggAdmin } from '@/components/admin/BloggAdmin'
import { Callout, PageHead } from '@/components/portal/ui'
import { ModuleWriteBoundary } from '@/components/admin/ModuleWriteBoundary'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Blogg · Adminpanel' }

export default async function BloggPage() {
  const user = await requireAdminArea('blogg')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <NoTenant />

  const states = await getAdminModuleStates(tenant.id)

  if (!isModuleActivated(states, 'blogg')) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Blogg" />
        <Callout tone="info" icon="info">
          Blogg är inte aktiverad för ditt företag. Be plattformsadmin aktivera modulen.
        </Callout>
      </section>
    )
  }

  const [posts, assets] = await Promise.all([
    listBlogPosts(tenant.id),
    listMediaAssets(tenant.id),
  ])
  const config = moduleAdminConfig(states, 'blogg')
  const layoutVariant = typeof config.layout === 'string' ? config.layout : null
  const readOnly = false

  return (
    <section className="portal-section">
      <ModuleWriteBoundary readOnly={readOnly}>
        <BloggAdmin
          posts={posts}
          tenantName={tenant.name}
          layoutVariant={layoutVariant}
          assets={assets}
        />
      </ModuleWriteBoundary>
    </section>
  )
}

function NoTenant() {
  return (
    <section className="portal-section">
      <PageHead eyebrow="Adminpanel" title="Blogg" />
      <p className="prose">Inget företag är kopplat till ditt konto.</p>
    </section>
  )
}
