import type { ReactNode } from 'react'
import Link from 'next/link'
import { PortalNavigationClient, type ActivePortalNav } from './PortalNavigationClient'
import { PortalRouteFocus } from './PortalRouteFocus'

type PortalShellProps = {
  active?: ActivePortalNav
  customerName?: string
  detailBackTarget?: '/mina' | '/mina/historik'
  variant?: 'standard' | 'recovery'
  children: ReactNode
}

export function PortalShell({
  active,
  customerName,
  detailBackTarget,
  variant = 'standard',
  children,
}: PortalShellProps) {
  if (variant === 'recovery') {
    return <PortalShellFrame recovery>{children}</PortalShellFrame>
  }

  return (
    <PortalShellFrame
      active={active ?? 'bookings'}
      customerName={customerName}
      detailBackTarget={detailBackTarget}
    >
      {children}
    </PortalShellFrame>
  )
}

function PortalShellFrame({
  active,
  customerName,
  detailBackTarget,
  recovery = false,
  children,
}: Omit<PortalShellProps, 'variant'> & { recovery?: boolean }) {
  return (
    <div className="customer-portal">
      <a className="cp-skip" href="#huvudinnehall">Hoppa till innehåll</a>
      <header className="cp-topbar">
        <div className="cp-topbar-inner">
          {recovery ? (
            <div className="cp-brand"><span>COREVO</span><small>MINA BOKNINGAR</small></div>
          ) : (
            <Link className="cp-brand" href="/mina"><span>COREVO</span><small>MINA BOKNINGAR</small></Link>
          )}
          {!recovery && (detailBackTarget ? (
            <Link className="cp-top-action cp-mobile-user" href={detailBackTarget}>Tillbaka</Link>
          ) : (
            <Link className="cp-top-action cp-mobile-user" href="/mina/profil" aria-label="Öppna profil">
              {customerName?.trim().slice(0, 2).toLocaleUpperCase('sv-SE') || (
                <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20c1-4 3-6 7-6s6 2 7 6" /></svg>
              )}
            </Link>
          ))}
          {!recovery && customerName && <span className="cp-desktop-user">{customerName.split(/\s+/)[0]}</span>}
        </div>
      </header>
      <div className={`cp-layout${recovery ? ' cp-layout-recovery' : ''}`}>
        {!recovery && <PortalNavigationClient active={active ?? 'bookings'} mode="desktop" />}
        <main id="huvudinnehall" tabIndex={-1}>
          {!recovery && <PortalRouteFocus />}
          {children}
        </main>
        {!recovery && <div className="cp-support" aria-hidden="true" />}
      </div>
      {!recovery && <PortalNavigationClient active={active ?? 'bookings'} mode="mobile" />}
    </div>
  )
}
