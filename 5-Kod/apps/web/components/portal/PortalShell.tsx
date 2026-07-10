import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant, getTenantById } from '@/lib/tenant-data'
import { tenantStorefrontUrl } from '@/lib/storefront-url'
import { createClient } from '@/lib/supabase/server'
import { cleanTerminology, resolveTerm } from '@/lib/platform/verticals-shared'
import type { CurrentUser } from '@/lib/auth/session'
import { SignOutButton } from './SignOutButton'
import { PortalSidebar, type PortalRole } from './PortalSidebar'
import { getAdminModuleStates, isModuleActivated } from '@/lib/admin/modules'
import { listLocations } from '@/lib/admin/data'
import { PLATS_COOKIE } from '@/lib/admin/plats'
import { PortalTopbar } from './PortalTopbar'
import { LocationSwitcher } from './LocationSwitcher'
import type { CommandItem } from './ui/CommandPalette'
import { ToastProvider } from './ui/Toast'

/** Role-keyed go-to list for the ⌘K command palette. Mirrors PortalSidebar's NAV
 *  (kept in sync by hand — PortalSidebar is outside this component's ownership;
 *  duplicating the small route map is the correct trade vs lifting NAV across a
 *  scope boundary). Only routes that actually exist appear — no 404 entries. */
const PALETTE: Record<PortalRole, CommandItem[]> = {
  platform: [
    { href: '/', label: 'Översikt', icon: 'grid', kind: 'Gå till' },
    { href: '/fakturering', label: 'Fakturering', icon: 'dollar', kind: 'Gå till' },
    { href: '/salonger', label: 'Salonger', icon: 'building', kind: 'Gå till' },
    { href: '/salonger/ny', label: 'Onboarda salong', icon: 'plus', kind: 'Gå till' },
    { href: '/kunder', label: 'Kunder', icon: 'users', kind: 'Gå till' },
    { href: '/personal-plattform', label: 'Personal', icon: 'scissors', kind: 'Gå till' },
    { href: '/drift-och-logg', label: 'Drift & logg', icon: 'alert', kind: 'Gå till' },
    { href: '/integrationer', label: 'Integrationer', icon: 'layers', kind: 'Gå till' },
    { href: '/roller', label: 'Roller', icon: 'shield', kind: 'Gå till' },
    { href: '/installningar', label: 'Inställningar', icon: 'settings', kind: 'Gå till' },
  ],
  admin: [
    { href: '/admin', label: 'Översikt', icon: 'home', kind: 'Gå till' },
    { href: '/admin/bokningar', label: 'Bokningar', icon: 'calendar', kind: 'Gå till' },
    { href: '/admin/kunder', label: 'Kunder', icon: 'user', kind: 'Gå till' },
    { href: '/admin/tjanster', label: 'Tjänster', icon: 'scissors', kind: 'Gå till' },
    { href: '/admin/personal', label: 'Personal', icon: 'users', kind: 'Gå till' },
    { href: '/admin/platser', label: 'Platser', icon: 'building', kind: 'Gå till' },
    { href: '/admin/scheman', label: 'Scheman', icon: 'clock', kind: 'Gå till' },
    { href: '/admin/sida', label: 'Redigera sidan', icon: 'palette', kind: 'Gå till' },
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
  theme,
  children,
}: {
  user: CurrentUser
  title: string
  world?: 'backoffice' | 'storefront'
  portal?: PortalRole
  /** Salon theme key for the customer (/konto) branch, applied to the shell root
   *  so the header is themed alongside the body. Ignored by the back-office branch
   *  (operator tools stay forest/gold regardless of salon theme). */
  theme?: string
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

    // Modulstyrd admin-yta: läs kundens tenant_modules EN gång här (RLS-scopad)
    // och låt sidomeny + ⌘K-palett visa BARA aktiverade moduler. Platform/personal
    // gatar inte (undefined → PortalSidebar visar allt).
    const MODULE_PALETTE: (CommandItem & { module: string })[] = [
      { href: '/admin/media', label: 'Bildbibliotek', icon: 'upload', kind: 'Gå till', module: 'media_library' },
      { href: '/admin/webshop', label: 'Webshop', icon: 'grid', kind: 'Gå till', module: 'shop' },
      { href: '/admin/blogg', label: 'Blogg', icon: 'edit', kind: 'Gå till', module: 'blogg' },
      { href: '/admin/offerter', label: 'Offerter', icon: 'mail', kind: 'Gå till', module: 'offert' },
      { href: '/admin/lojalitet', label: 'Lojalitet', icon: 'star', kind: 'Gå till', module: 'lojalitet' },
      { href: '/admin/presentkort', label: 'Presentkort', icon: 'gift', kind: 'Gå till', module: 'presentkort' },
    ]
    let activeModuleKeys: string[] | undefined
    let paletteItems: CommandItem[] = PALETTE[portal]
    if (portal === 'admin' && bundle) {
      const states = await getAdminModuleStates(bundle.tenant.id)
      activeModuleKeys = MODULE_PALETTE.map((m) => m.module).filter((k) => isModuleActivated(states, k))
      paletteItems = [
        ...PALETTE.admin,
        ...MODULE_PALETTE.filter((m) => activeModuleKeys!.includes(m.module)).map(
          ({ module: _m, ...item }) => item,
        ),
      ]
    }
    // Bransch terminology overlay for the sidebar identity cell. Resolve the
    // tenant's vertical terminology on the server (mirrors getAdminTenant's
    // separate-read seam: a verticals shape/RLS change can never null the
    // chrome — on any miss the overlay stays {} → today's hardcoded word). The
    // platform portal has no single tenant (bundle null) → overlay stays {} and
    // the platform_admin path below never consults the staff entry anyway.
    let terminology: ReturnType<typeof cleanTerminology> = {}
    if (bundle?.tenant.vertical_id) {
      const supabase = await createClient()
      const { data: vertical } = await supabase
        .from('verticals')
        .select('terminology')
        .eq('key', bundle.tenant.vertical_id)
        .maybeSingle()
      terminology = cleanTerminology(vertical?.terminology)
    }
    // Humanize the raw role enum for the sidebar identity cell (mock shows
    // "Ägare", not "salon_admin"). Falls back to the raw name for unmapped roles.
    // 'staff' speaks the tenant's bransch via terminology (fallback 'Frisör' = the
    // historical hardcoded word → a no-override tenant renders exactly today's text).
    const roleLabel: Record<string, string> = {
      salon_admin: 'Ägare',
      owner: 'Ägare',
      staff: resolveTerm(terminology, 'staff', 'Frisör'),
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

    // Global butik-väljare (Zivar 2026-07-10): vid >1 AKTIV plats får salongs-
    // admin en switcher i topbaren; valet bor i corevo-plats-cookien och styr
    // Bokningar/Scheman/Bokningsvyns default (lib/admin/plats.ts).
    let locationSwitcher: ReactNode = null
    if (portal === 'admin' && bundle) {
      const activeLocations = (await listLocations(bundle.tenant.id)).filter((l) => l.active)
      if (activeLocations.length > 1) {
        const jar = await cookies()
        const saved = jar.get(PLATS_COOKIE)?.value ?? ''
        const value = activeLocations.some((l) => l.id === saved) ? saved : ''
        locationSwitcher = (
          <LocationSwitcher
            locations={activeLocations.map((l) => ({ id: l.id, name: l.name }))}
            value={value}
          />
        )
      }
    }

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
          activeModuleKeys={activeModuleKeys}
        />
        <div className="portal-col">
          <PortalTopbar
            placeholder={
              portal === 'platform'
                ? 'Sök salong, kund, personal, åtgärd…'
                : 'Sök bokning, kund, tjänst…'
            }
            paletteItems={paletteItems}
            contextLink={contextLink}
            extra={locationSwitcher}
          />
          <main className="portal-main">
            <ToastProvider>{children}</ToastProvider>
          </main>
        </div>
      </div>
    )
  }

  // Customer /konto — a STOREFRONT salon header (the salon's own product), NOT the
  // back-office portal chrome. data-world + data-theme + the inline tenant-token
  // overrides all sit on THIS root element (the override must beat the
  // [data-world][data-theme] block, which only holds on one element), so the header
  // is themed alongside the body and no descendant re-declares the theme.
  //
  // The salon name is the wordmark (links to the storefront home), the customer's
  // initial sits in a compact avatar, and Logga ut is the only action. The email +
  // raw role enum ("· kund") are NOT surfaced — that was a back-office leak; a
  // customer never sees their role on their own salon page.
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const fullName = ((authUser?.user_metadata ?? {}) as { full_name?: string }).full_name?.trim() || null
  const initial = (fullName?.charAt(0) || user.email?.charAt(0) || '·').toUpperCase()

  return (
    <div
      className="tenant-root konto-shell"
      data-world={world}
      data-theme={theme}
      data-tenant={bundle?.tenant.id}
      style={injectTenantTokens(branding) as CSSProperties}
    >
      <header className="konto-header">
        <div className="konto-header-inner">
          <Link href="/" className="konto-ident" aria-label={`${tenantName} – till startsidan`}>
            <span className="konto-wordmark">{tenantName}</span>
            <span className="konto-eyebrow">{title}</span>
          </Link>
          <div className="konto-user">
            <span className="konto-avatar" aria-hidden>
              {initial}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="portal-main">{children}</main>
    </div>
  )
}
