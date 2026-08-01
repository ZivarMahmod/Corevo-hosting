'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'

export type ActivePortalNav = 'bookings' | 'history' | 'profile'

const NAV = [
  { key: 'bookings', href: '/mina', label: 'Bokningar', icon: 'home' },
  { key: 'history', href: '/mina/historik', label: 'Historik', icon: 'history' },
  { key: 'profile', href: '/mina/profil', label: 'Profil', icon: 'profile' },
] as const

const DESKTOP_QUERY = '(min-width: 780px)'

function subscribeToDesktopQuery(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches
}

function NavIcon({ icon }: { icon: (typeof NAV)[number]['icon'] }) {
  return (
    <svg className="cp-icon cp-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {icon === 'home' && <><path d="m3 11 9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></>}
      {icon === 'history' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {icon === 'profile' && <><circle cx="12" cy="8" r="3" /><path d="M5 20c1-4 3-6 7-6s6 2 7 6" /></>}
    </svg>
  )
}

export function PortalNavigationClient({
  active,
  mode,
  tenantName,
}: {
  active: ActivePortalNav
  mode: 'desktop' | 'mobile'
  tenantName?: string
}) {
  const isDesktop = useSyncExternalStore(subscribeToDesktopQuery, getDesktopSnapshot, () => false)
  if ((mode === 'desktop') !== isDesktop) return null

  return (
    <nav className={mode === 'desktop' ? 'cp-sidenav' : 'cp-bottomnav'} aria-label="Huvudmeny">
      {mode === 'desktop' && (
        <div className="cp-side-brand" aria-hidden="true">
          <span className="cp-brand-mark">C</span>
          <span className="cp-side-brand-copy">
            <strong>Corevo</strong>
            {tenantName && <small>{tenantName}</small>}
          </span>
        </div>
      )}
      <ul>
        {NAV.map((item) => (
          <li key={item.key}>
            <Link
              className="cp-nav-link"
              href={item.href}
              aria-current={active === item.key ? 'page' : undefined}
            >
              <NavIcon icon={item.icon} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
