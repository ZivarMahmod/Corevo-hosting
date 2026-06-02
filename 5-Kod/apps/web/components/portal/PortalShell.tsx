import type { CSSProperties, ReactNode } from 'react'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant, getTenantById } from '@/lib/tenant-data'
import type { CurrentUser } from '@/lib/auth/session'
import { SignOutButton } from './SignOutButton'
import { PortalSidebar, type PortalRole } from './PortalSidebar'
import { Icon } from './ui/Icon'

/** Shared, tenant-themed chrome for every portal (kund/personal/admin/platform).
 *
 * `world` namespaces the surface for the two-CSS-worlds system. The three
 * back-office portals (admin/personal/platform) pass `"backoffice"` AND a
 * `portal` role; the customer-facing /konto area passes nothing — it stays
 * un-worlded and keeps the simple top-header layout it always had (its tokens
 * still resolve from injectTenantTokens/:root, unchanged).
 *
 * Back-office (World 2) renders the Corevo handoff chrome: a dark forest sidebar
 * (role-driven nav, in <PortalSidebar>) + a topbar (search + user + signout) +
 * a cream content area. EVERY back-office style is keyed off
 * [data-world="backoffice"] (see app/portal-global.css), so /konto is untouched.
 * The tenant tokens are still injected on this root, but the back-office chrome
 * reads only the fixed --c-* Corevo palette (not the tenant-overridable
 * --color-*), so the operator tools stay forest/gold regardless of salon theme —
 * the tenant NAME still shows as the sidebar brand. */
export async function PortalShell({
  user,
  title,
  world,
  portal,
  children,
}: {
  user: CurrentUser
  title: string
  world?: 'backoffice' | 'storefront'
  portal?: PortalRole
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

  const backoffice = world === 'backoffice' && !!portal

  if (backoffice) {
    const brand = portal === 'platform' ? 'Corevo' : tenantName
    const email = user.email ?? ''
    const userLabel = email.split('@')[0] || email || 'Konto'
    const metaSuffix = `${user.roleName ? ` · ${user.roleName}` : ''}${user.platformAdmin ? ' · platform' : ''}`
    const userSub = user.platformAdmin
      ? 'Corevo AB'
      : user.roleName
        ? user.roleName
        : 'inloggad'

    return (
      <div
        className="tenant-root portal-shell"
        data-world={world}
        data-tenant={bundle?.tenant.id}
        style={injectTenantTokens(branding) as CSSProperties}
      >
        <PortalSidebar
          role={portal}
          brand={brand}
          userLabel={userLabel}
          userSub={userSub}
        />
        <div className="portal-col">
          <header className="portal-topbar">
            <div className="portal-search">
              <span className="portal-search-icon" aria-hidden="true">
                <Icon name="search" size={17} />
              </span>
              <input type="search" placeholder="Sök…" aria-label="Sök" />
            </div>
            <div className="portal-topbar-right">
              <span className="portal-topbar-title">{title}</span>
              <span className="portal-topbar-user">
                {email}
                {metaSuffix}
              </span>
              <SignOutButton />
            </div>
          </header>
          <main className="portal-main">{children}</main>
        </div>
      </div>
    )
  }

  // Customer /konto — un-worlded, original top-header layout (unchanged).
  return (
    <div
      className="tenant-root"
      data-world={world}
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
