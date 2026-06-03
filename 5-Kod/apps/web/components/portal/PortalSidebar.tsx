'use client'

import type { ReactNode } from 'react'
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
    items: [
      { group: 'Insyn' },
      { href: '/', label: 'Översikt', icon: 'grid' },
      { href: '/fakturering', label: 'Fakturering', icon: 'creditCard' },
      { group: 'Tenants' },
      { href: '/salonger', label: 'Salonger', icon: 'building' },
      { href: '/salonger/ny', label: 'Onboarda salong', icon: 'plus' },
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

  return (
    <aside className="portal-aside">
      <div className="portal-aside-brand">
        <span className="portal-aside-mark" aria-hidden="true">
          C
        </span>
        <span className="portal-aside-brand-text">
          <span className="portal-aside-brand-name">{brand}</span>
          <span className="portal-aside-brand-sub">{cfg.sub}</span>
        </span>
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
            >
              <Icon name={entry.icon} size={18} stroke={1.7} />
              {entry.label}
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
