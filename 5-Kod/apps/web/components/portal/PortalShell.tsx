import type { CSSProperties, ReactNode } from 'react'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant, getTenantById } from '@/lib/tenant-data'
import type { CurrentUser } from '@/lib/auth/session'
import { SignOutButton } from './SignOutButton'

/** Shared, tenant-themed chrome for every portal (kund/personal/admin/platform). */
export async function PortalShell({
  user,
  title,
  children,
}: {
  user: CurrentUser
  title: string
  children: ReactNode
}) {
  // Storefront/kund portals resolve the tenant from the host. Back-office portals
  // (admin/personal) run on booking.corevo.se where the host carries NO tenant —
  // so fall back to the logged-in account's own tenant (G12). platform_admin has
  // no single tenant → stays "Corevo".
  let bundle = await currentTenant()
  if (!bundle && user.tenantId && !user.platformAdmin) {
    bundle = await getTenantById(user.tenantId)
  }
  const branding = bundle?.settings.branding ?? {}
  const tenantName = bundle?.tenant.name ?? 'Corevo'

  return (
    <div
      className="tenant-root"
      data-tenant={bundle?.tenant.id}
      style={injectTenantTokens(branding) as CSSProperties}
    >
      <header className="portal-header">
        <div className="portal-header-inner">
          <div className="portal-ident">
            <span className="portal-tenant">{tenantName}</span>
            <span className="portal-title">{title}</span>
          </div>
          <div className="portal-user">
            <span className="portal-user-meta">
              {user.email}
              {user.roleName ? ` · ${user.roleName}` : ''}
              {user.platformAdmin ? ' · platform' : ''}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="portal-main">{children}</main>
    </div>
  )
}
