import Link from 'next/link'
import type { ReactNode } from 'react'

type ActivePortalNav = 'bookings' | 'history' | 'profile'

const NAV = [
  { key: 'bookings', href: '/mina', label: 'Bokningar', icon: 'home' },
  { key: 'history', href: '/mina/historik', label: 'Historik', icon: 'history' },
  { key: 'profile', href: '/mina/profil', label: 'Profil', icon: 'profile' },
] as const

function NavIcon({ icon }: { icon: (typeof NAV)[number]['icon'] }) {
  return (
    <svg className="cp-icon cp-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {icon === 'home' && <><path d="m3 11 9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></>}
      {icon === 'history' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {icon === 'profile' && <><circle cx="12" cy="8" r="3" /><path d="M5 20c1-4 3-6 7-6s6 2 7 6" /></>}
    </svg>
  )
}

function PortalNavigation({ active, className }: { active: ActivePortalNav; className: string }) {
  return (
    <nav className={className} aria-label="Huvudmeny">
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

export function PortalShell({
  active,
  customerName,
  detailBackTarget,
  children,
}: {
  active: ActivePortalNav
  customerName?: string
  detailBackTarget?: '/mina' | '/mina/historik'
  children: ReactNode
}) {
  return (
    <div className="customer-portal">
      <a className="cp-skip" href="#huvudinnehall">Hoppa till innehåll</a>
      <header className="cp-topbar">
        <Link className="cp-brand" href="/mina">
          <span>COREVO</span>
          <small>MINA BOKNINGAR</small>
        </Link>
        {detailBackTarget ? (
          <Link className="cp-top-action cp-mobile-user" href={detailBackTarget}>Tillbaka</Link>
        ) : (
          <Link className="cp-top-action cp-mobile-user" href="/mina/profil" aria-label="Öppna profil">
            {customerName?.trim().slice(0, 2).toLocaleUpperCase('sv-SE') || (
              <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20c1-4 3-6 7-6s6 2 7 6" /></svg>
            )}
          </Link>
        )}
        {customerName && <span className="cp-desktop-user">{customerName.split(/\s+/)[0]}</span>}
      </header>
      <div className="cp-layout">
        <PortalNavigation active={active} className="cp-sidenav" />
        <main id="huvudinnehall" tabIndex={-1}>{children}</main>
        <div className="cp-support" aria-hidden="true" />
      </div>
      <PortalNavigation active={active} className="cp-bottomnav" />
    </div>
  )
}
