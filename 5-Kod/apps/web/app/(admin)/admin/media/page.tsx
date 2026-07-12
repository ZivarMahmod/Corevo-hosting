import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated, moduleAdminConfig } from '@/lib/admin/modules'
import { listMediaAssets, getStorageUsage } from '@/lib/admin/media/data'
import { MediaLibrary } from '@/components/admin/MediaLibrary'
import { PageHead, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bildbibliotek · Adminpanel' }

export default async function MediaPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Bildbibliotek" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const states = await getAdminModuleStates(tenant.id)

  if (!isModuleActivated(states, 'media_library')) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Bildbibliotek" />
        <Callout tone="info" icon="info">
          Bildbibliotek är inte aktiverat för ditt företag. Be plattformsadmin aktivera modulen.
        </Callout>
      </section>
    )
  }

  const config = moduleAdminConfig(states, 'media_library')
  const quotaBytes = typeof config.quota_bytes === 'number' ? config.quota_bytes : 500 * 1024 * 1024

  const [assets, usage] = await Promise.all([
    listMediaAssets(tenant.id),
    getStorageUsage(tenant.id, quotaBytes),
  ])

  return (
    <section className="portal-section">
      <MediaLibrary assets={assets} usage={usage} tenantName={tenant.name} />
    </section>
  )
}
