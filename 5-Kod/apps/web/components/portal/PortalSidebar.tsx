'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from './ui/Icon'

export type PortalRole = 'admin' | 'platform' | 'personal'

type NavItem = { href: string; label: string; icon: IconName }
type NavConfig = { sub: string; items: NavItem[] }

/** Role-driven nav sets + their active-path matching. The three back-office
 *  portals live at different roots (admin → /admin, platform → / on
 *  booking.corevo.se, personal → /personal), so each keeps its own match rule —
 *  these are NOT unified (matches the existing AdminNav/PlatformNav/PersonalNav). */
const NAV: Record<PortalRole, NavConfig> = {
  platform: {
    sub: 'Plattform',
    items: [
      { href: '/', label: 'Översikt', icon: 'grid' },
      { href: '/salonger', label: 'Salonger', icon: 'building' },
      { href: '/salonger/ny', label: 'Onboarda salong', icon: 'plus' },
      { href: '/fakturering', label: 'Fakturering', icon: 'creditCard' },
    ],
  },
  admin: {
    sub: 'Salong-admin',
    items: [
      { href: '/admin', label: 'Översikt', icon: 'home' },
      { href: '/admin/bokningar', label: 'Bokningar', icon: 'calendar' },
      { href: '/admin/tjanster', label: 'Tjänster', icon: 'scissors' },
      { href: '/admin/personal', label: 'Personal', icon: 'users' },
      { href: '/admin/scheman', label: 'Scheman', icon: 'clock' },
      { href: '/admin/varumarke', label: 'Varumärke', icon: 'palette' },
      { href: '/admin/installningar', label: 'Inställningar', icon: 'settings' },
    ],
  },
  personal: {
    sub: 'Personal',
    items: [
      { href: '/personal', label: 'Idag', icon: 'grid' },
      { href: '/personal/arbetstider', label: 'Arbetstider', icon: 'calendar' },
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
}: {
  role: PortalRole
  brand: string
  userLabel: string
  userSub: string
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
        {cfg.items.map((item) => {
          const on = isActive(item.href, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`portal-aside-link${on ? ' is-active' : ''}`}
              aria-current={on ? 'page' : undefined}
            >
              <Icon name={item.icon} size={18} stroke={1.7} />
              {item.label}
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
      </div>
    </aside>
  )
}
