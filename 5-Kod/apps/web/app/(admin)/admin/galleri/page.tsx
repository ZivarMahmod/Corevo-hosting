import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import {
  getAdminModuleStates,
  isModuleActivated,
  moduleAdminState,
} from '@/lib/admin/modules'
import { listGalleryItems } from '@/lib/admin/galleri/data'
import { listMediaAssets } from '@/lib/admin/media/data'
import { GalleriAdmin } from '@/components/admin/GalleriAdmin'
import { Callout, PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Galleri · Adminpanel' }

export default async function GalleriPage() {
  const user = await requireAdminArea('galleri')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Galleri" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const states = await getAdminModuleStates(tenant.id)
  if (!isModuleActivated(states, 'galleri')) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Galleri" />
        <Callout tone="info" icon="info">
          Galleri är inte aktiverat för ditt företag. Be plattformsadmin aktivera modulen.
        </Callout>
      </section>
    )
  }

  const state = moduleAdminState(states, 'galleri')
  const [items, assets] = await Promise.all([
    listGalleryItems(tenant.id),
    listMediaAssets(tenant.id),
  ])

  return (
    <section className="portal-section">
      <GalleriAdmin
        items={items}
        assets={assets}
        tenantName={tenant.name}
        previewHref={`/salong-preview/${tenant.slug}/galleri`}
        readOnly={state === 'paused'}
      />
    </section>
  )
}
