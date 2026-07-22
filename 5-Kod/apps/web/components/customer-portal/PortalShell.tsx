import type { ReactNode } from 'react'
import Link from 'next/link'
import { PortalNavigationClient, type ActivePortalNav } from './PortalNavigationClient'
import { PortalRouteFocus } from './PortalRouteFocus'

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
        <div className="cp-topbar-inner">
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
        </div>
      </header>
      <div className="cp-layout">
        <PortalNavigationClient active={active} mode="desktop" />
        <main id="huvudinnehall" tabIndex={-1}>
          <PortalRouteFocus />
          {children}
        </main>
        <div className="cp-support" aria-hidden="true" />
      </div>
      <PortalNavigationClient active={active} mode="mobile" />
    </div>
  )
}
