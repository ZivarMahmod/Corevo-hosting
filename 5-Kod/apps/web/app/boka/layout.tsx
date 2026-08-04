import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'

// Per-request, host-resolved tenant theme → never prerender.
export const dynamic = 'force-dynamic'

// The standalone wizard remains the sole booking UI on /boka; the canonical
// storefront shell therefore renders its chrome without an embedded provider.
export default async function BokaLayout({ children }: { children: ReactNode }) {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  if (!isModuleLive(await getTenantModuleStates(tenant.id, tenant.slug), 'booking')) notFound()

  return (
    <StorefrontShell bundle={bundle} surface="public" embeddedBooking={false}>
      {children}
    </StorefrontShell>
  )
}
