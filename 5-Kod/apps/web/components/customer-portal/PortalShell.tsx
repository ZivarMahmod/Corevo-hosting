import type { ReactNode } from 'react'
import Link from 'next/link'
import { PortalNavigationClient, type ActivePortalNav } from './PortalNavigationClient'
import { PortalRouteFocus } from './PortalRouteFocus'
import { PortalCancellationFeedbackProvider } from './PortalCancellationFeedback'
import { PortalLogoutTrigger, PortalSessionBoundary } from './PortalSessionBoundary'

type PortalShellProps = {
  active?: ActivePortalNav
  customerName?: string
  tenantSlug?: string
  detailBackTarget?: '/mina' | '/mina/historik'
  variant?: 'standard' | 'recovery'
  children: ReactNode
}

export function PortalShell({
  active,
  customerName,
  tenantSlug,
  detailBackTarget,
  variant = 'standard',
  children,
}: PortalShellProps) {
  if (variant === 'recovery') {
    return <PortalShellFrame recovery>{children}</PortalShellFrame>
  }

  const frame = (
    <PortalCancellationFeedbackProvider>
      <PortalShellFrame
        active={active ?? 'bookings'}
        customerName={customerName}
        tenantSlug={tenantSlug}
        detailBackTarget={detailBackTarget}
      >
        {children}
      </PortalShellFrame>
    </PortalCancellationFeedbackProvider>
  )
  return tenantSlug
    ? <PortalSessionBoundary tenantSlug={tenantSlug}>{frame}</PortalSessionBoundary>
    : frame
}

function PortalShellFrame({
  active,
  customerName,
  tenantSlug,
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
              {customerInitials(customerName) || (
                <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20c1-4 3-6 7-6s6 2 7 6" /></svg>
              )}
            </Link>
          ))}
          {!recovery && tenantSlug && (
            <div className="cp-desktop-user">
              {customerName?.trim() && <span>{customerName.trim().split(/\s+/)[0]}</span>}
              <PortalLogoutTrigger className="cp-top-action">Logga ut</PortalLogoutTrigger>
            </div>
          )}
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

function customerInitials(customerName: string | undefined): string {
  const parts = customerName?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return ''
  const first = [...(parts[0] ?? '')][0] ?? ''
  const second = parts.length > 1
    ? [...(parts.at(-1) ?? '')][0] ?? ''
    : [...(parts[0] ?? '')][1] ?? ''
  return `${first}${second}`.toLocaleUpperCase('sv-SE')
}
