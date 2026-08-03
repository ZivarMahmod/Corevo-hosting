'use client'

import dynamic from 'next/dynamic'

const RealtimeTenantModules = dynamic(
  () => import('./RealtimeTenantModules').then((module) => module.RealtimeTenantModules),
  { ssr: false },
)

export function RealtimeTenantModulesLazy({ tenantId }: { tenantId?: string }) {
  return <RealtimeTenantModules tenantId={tenantId} />
}
