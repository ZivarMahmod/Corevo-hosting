'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from './ui/Icon'

export type PortalRole = 'admin' | 'platform' | 'personal'

type NavItem = { href: string; label: string; icon: IconName }
/** A nav entry is either a group header (handoff Sidebar groups the rail by
 *  area: Insyn/Tenants… for super, Din dag/Hantera/Din sida for salon) or a
 *  link. We only group items whose routes actually exist — no 404 placeholders. */
type NavEntry = { group: string } | NavItem
type NavConfig = { sub: string; items: NavEntry[] }

const isGroup = (e: NavEntry): e is { group: string } => 'group' in e

/** Role-driven nav sets + their active-path matching. The three back-office
 *  portals live at different roots (admin → /admin, platform → / on
 *  booking.corevo.se, personal → /personal), so each keeps its own match rule —
 *  these are NOT unified (matches the existing AdminNav/PlatformNav/PersonalNav).
 *  Grouping + order follow the v3 handoff (design_handoff_backoffice/Shell.jsx → NAV). */
const NAV: Record<PortalRole, NavConfig> = {
  platform: {
    sub: 'Plattform',
    // Groups/labels/order/icons are the rendered handoff (Shell.jsx → NAV.super):
    //   Insyn · Tenants · Data & drift · Plattform. ASCII routes only (the å in
    //   "Inställningar" → /installningar, matching /admin/installningar — non-ASCII
    //   in build paths is documented-fragile here). All icons are in IconName.
    items: [
      // Insyn = plattform-övergripande. IA-vision punkt 3: den gamla egna gruppen
      // "Data & drift" är borta; per-kund-data bor i kundkortet (/salonger/[id] →
      // flikar Data/Personal/Drift). De GLOBALA tvär-kund-verktygen (slutkund-sök
      // över alla, all-personal, alla loggar) hör hemma här under Insyn, inte som
      // egen konkurrerande grupp — de är insyn över hela plattformen.
      { group: 'Insyn' },
      { href: '/', label: 'Översikt', icon: 'grid' },
      { href: '/fakturering', label: 'Fakturering', icon: 'dollar' },
      { href: '/kunder', label: 'Slutkunder', icon: 'users' },
      { href: '/personal-plattform', label: 'Personal', icon: 'scissors' },
      { href: '/drift-och-logg', label: 'Loggar', icon: 'alert' },
      { group: 'Kunder' },
      { href: '/salonger', label: 'Kunder', icon: 'building' },
      { href: '/salonger/ny', label: 'Onboarda kund', icon: 'plus' },
      { group: 'Plattform' },
      { href: '/integrationer', label: 'Integrationer', icon: 'layers' },
      { href: '/domaner', label: 'Domäner', icon: 'link' },
      { href: '/roller', label: 'Roller', icon: 'shield' },
      { href: '/installningar', label: 'Inställningar', icon: 'settings' },
    ],
  },
  admin: {
    sub: 'Salong-admin',
    items: [
      { group: 'Din dag' },
      { href: '/admin', label: 'Översikt', icon: 'home' },
      { href: '/admin/bokningar', label: 'Bokningar', icon: 'calendar' },
      { group: 'Hantera' },
      { href: '/admin/kunder', label: 'Kunder', icon: 'user' },
      { href: '/admin/tjanster', label: 'Tjänster', icon: 'scissors' },
      { href: '/admin/personal', label: 'Personal', icon: 'users' },
      { href: '/admin/platser', label: 'Platser', icon: 'building' },
      { href: '/admin/scheman', label: 'Scheman', icon: 'clock' },
      { group: 'Moduler' },
      { href: '/admin/media', label: 'Bildbibliotek', icon: 'upload' },
      { href: '/admin/webshop', label: 'Webshop', icon: 'grid' },
      { href: '/admin/blogg', label: 'Blogg', icon: 'edit' },
      { href: '/admin/offerter', label: 'Offerter', icon: 'mail' },
      { href: '/admin/lojalitet', label: 'Lojalitet', icon: 'star' },
      { href: '/admin/presentkort', label: 'Presentkort', icon: 'gift' },
      { group: 'Din sida' },
      { href: '/admin/varumarke', label: 'Varumärke', icon: 'palette' },
      { href: '/admin/installningar', label: 'Inställningar', icon: 'settings' },
    ],
  },
  personal: {
    sub: 'Personal',
    items: [
      { href: '/personal', label: 'Idag', icon: 'home' },
      { href: '/personal/arbetstider', label: 'Mitt schema', icon: 'calendar' },
      { href: '/personal/franvaro', label: 'Frånvaro', icon: 'coffee' },
    ],
  },
}

// Exact-match roots that must not be active for every sub-path.
const EXACT = new Set(['/', '/admin', '/personal', '/salonger/ny'])

function isActive(href: string, pathname: string) {
  if (EXACT.has(href)) {
    // /salonger/ny must win over /salonger when on the create page.
    if (href === '/salonger/ny') return pathname === '/salonger/ny'
    return pathname === href
  }
  // /salonger should not light up while on /salonger/ny.
  if (href === '/salonger') return pathname === '/salonger' || /^\/salonger\/(?!ny$)/.test(pathname)
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PortalSidebar({
  role,
  brand,
  userLabel,
  userSub,
  signOut,
}: {
  role: PortalRole
  brand: string
  userLabel: string
  userSub: string
  /** SignOutButton element — handoff puts logout in the sidebar footer cell. */
  signOut?: ReactNode
}) {
  const pathname = usePathname()
  const cfg = NAV[role]
  // Collapsible rail (Zivar: "jag vill kunna gömma den men den ska inte bara försvinna
  // när jag klickar onboarda ny kund"). A manual toggle, NEVER an auto-hide — the sidebar
  // stays open on every page (incl. onboarding) so the studio reads as the same connected
  // surface, not a separate place; the operator hides it themselves via the chevron.
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`portal-aside${collapsed ? ' is-collapsed' : ''}`}>
      <div className="portal-aside-brand">
        <span className="portal-aside-mark" aria-hidden="true">
          C
        </span>
        <span className="portal-aside-brand-text">
          <span className="portal-aside-brand-name">{brand}</span>
          <span className="portal-aside-brand-sub">{cfg.sub}</span>
        </span>
        <button
          type="button"
          className="portal-aside-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Visa sidopanelen' : 'Dölj sidopanelen'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Visa meny' : 'Dölj meny'}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={16} />
        </button>
      </div>

      <nav className="portal-aside-nav">
        {cfg.items.map((entry, i) => {
          if (isGroup(entry)) {
            return (
              <div
                key={`g-${entry.group}`}
                className={`portal-aside-group${i === 0 ? ' is-first' : ''}`}
              >
                {entry.group}
              </div>
            )
          }
          const on = isActive(entry.href, pathname)
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className={`portal-aside-link${on ? ' is-active' : ''}`}
              aria-current={on ? 'page' : undefined}
              title={entry.label}
            >
              <Icon name={entry.icon} size={18} stroke={1.7} />
              <span className="portal-aside-link-label">{entry.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="portal-aside-user">
        <span className="portal-aside-avatar" aria-hidden="true">
          {userLabel.charAt(0).toUpperCase()}
        </span>
        <span className="portal-aside-user-text">
          <span className="portal-aside-user-name">{userLabel}</span>
          <span className="portal-aside-user-sub">{userSub}</span>
        </span>
        {signOut ? <span className="portal-aside-logout">{signOut}</span> : null}
      </div>
    </aside>
  )
}
