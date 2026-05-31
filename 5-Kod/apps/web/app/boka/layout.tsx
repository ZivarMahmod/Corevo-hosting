import type { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'

// Per-request, host-resolved tenant theme → never prerender.
export const dynamic = 'force-dynamic'

export default async function BokaLayout({ children }: { children: React.ReactNode }) {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle

  return (
    <div
      className="tenant-root"
      data-tenant={tenant.id}
      style={injectTenantTokens(settings.branding) as CSSProperties}
    >
      <header className="boka-header">
        <div className="boka-header-inner">
          <Link href="/" className="logo-text">
            {tenant.name}
          </Link>
          <Link href="/" className="boka-back">
            Avbryt
          </Link>
        </div>
      </header>
      <main className="tenant-main">{children}</main>
    </div>
  )
}
