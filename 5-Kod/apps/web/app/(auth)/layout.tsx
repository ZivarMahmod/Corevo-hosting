import type { CSSProperties } from 'react'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'

// Per-request, host-resolved tenant theme → never prerender.
export const dynamic = 'force-dynamic'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const bundle = await currentTenant()
  const branding = bundle?.settings.branding ?? {}
  const tenantName = bundle?.tenant.name ?? 'Corevo'

  return (
    <div
      className="tenant-root auth-root"
      data-tenant={bundle?.tenant.id}
      style={injectTenantTokens(branding) as CSSProperties}
    >
      <main className="auth-main">
        <div className="auth-card">
          <p className="auth-brand">{tenantName}</p>
          {children}
          <p className="auth-foot">Drivs av Corevo</p>
        </div>
      </main>
    </div>
  )
}
