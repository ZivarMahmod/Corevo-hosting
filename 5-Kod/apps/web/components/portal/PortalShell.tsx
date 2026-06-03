import type { CSSProperties, ReactNode } from 'react'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant, getTenantById } from '@/lib/tenant-data'
import { tenantStorefrontUrl } from '@/lib/storefront-url'
import type { CurrentUser } from '@/lib/auth/session'
import { SignOutButton } from './SignOutButton'
import { PortalSidebar, type PortalRole } from './PortalSidebar'
import { PortalTopbar } from './PortalTopbar'
import type { CommandItem } from './ui/CommandPalette'
import { ToastProvider } from './ui/Toast'

/** Role-keyed go-to list for the ⌘K command palette. Mirrors PortalSidebar's NAV
 *  (kept in sync by hand — PortalSidebar is outside this component's ownership;
 *  duplicating the small route map is the correct trade vs lifting NAV across a
 *  scope boundary). Only routes that actually exist appear — no 404 entries. */
const PALETTE: Record<PortalRole, CommandItem[]> = {
  platform: [
    { href: '/', label: 'Översikt', icon: 'grid', kind: 'Gå till' },
    { href: '/fakturering', label: 'Fakturering', icon: 'creditCard', kind: 'Gå till' },
    { href: '/salonger', label: 'Salonger', icon: 'building', kind: 'Gå till' },
    { href: '/salonger/ny', label: 'Onboarda salong', icon: 'plus', kind: 'Gå till' },
  ],
  admin: [
    { href: '/admin', label: 'Översikt', icon: 'home', kind: 'Gå till' },
    { href: '/admin/bokningar', label: 'Bokningar', icon: 'calendar', kind: 'Gå till' },
    { href: '/admin/kunder', label: 'Kunder', icon: 'user', kind: 'Gå till' },
    { href: '/admin/tjanster', label: 'Tjänster', icon: 'scissors', kind: 'Gå till' },
    { href: '/admin/personal', label: 'Personal', icon: 'users', kind: 'Gå till' },
    { href: '/admin/platser', label: 'Platser', icon: 'building', kind: 'Gå till' },
    { href: '/admin/scheman', label: 'Scheman', icon: 'clock', kind: 'Gå till' },
    { href: '/admin/varumarke', label: 'Varumärke', icon: 'palette', kind: 'Gå till' },
    { href: '/admin/installningar', label: 'Inställningar', icon: 'settings', kind: 'Gå till' },
  ],
  personal: [
    { href: '/personal', label: 'Idag', icon: 'grid', kind: 'Gå till' },
    { href: '/personal/arbetstider', label: 'Arbetstider', icon: 'calendar', kind: 'Gå till' },
    { href: '/personal/franvaro', label: 'Frånvaro', icon: 'coffee', kind: 'Gå till' },
  ],
}

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
    // Humanize the raw role enum for the sidebar identity cell (mock shows
    // "Ägare", not "salon_admin"). Falls back to the raw name for unmapped roles.
    const roleLabel: Record<string, string> = {
      salon_admin: 'Ägare',
      owner: 'Ägare',
      staff: 'Frisör',
      platform_admin: 'Plattform',
    }
    const userSub = user.platformAdmin
      ? 'Corevo AB'
      : user.roleName
        ? (roleLabel[user.roleName] ?? user.roleName)
        : 'inloggad'
    // Topbar context link — handoff shows "Se din sida" → the salon's public
    // storefront (computed from the slug so it's correct in dev AND prod, never
    // the localhost env base). Platform has no single storefront → no link.
    const storefrontUrl =
      portal === 'platform' ? null : tenantStorefrontUrl(bundle?.tenant.slug)
    const contextLink = storefrontUrl
      ? { label: 'Se din sida', href: storefrontUrl }
      : undefined

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
          signOut={<SignOutButton compact />}
        />
        <div className="portal-col">
          <PortalTopbar
            placeholder={
              portal === 'platform'
                ? 'Sök salong, kund, personal, åtgärd…'
                : 'Sök bokning, kund, tjänst…'
            }
            paletteItems={PALETTE[portal]}
            contextLink={contextLink}
          />
          <main className="portal-main">
            <ToastProvider>{children}</ToastProvider>
          </main>
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
