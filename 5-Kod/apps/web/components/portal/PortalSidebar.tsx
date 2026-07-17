'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './ui/Icon'
// NAV bor i nav-items.ts — SAMMA lista driver ⌘K-paletten (PortalShell via
// paletteFromNav), så sidomeny och palett kan inte drifta isär (goal-55 steg 1).
import { NAV, isGroup, isNavItemVisible, type PortalRole } from './nav-items'

export type { PortalRole }

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
  activeModuleKeys,
  roleLevel,
  grantedAreas,
}: {
  role: PortalRole
  brand: string
  userLabel: string
  userSub: string
  /** SignOutButton element — handoff puts logout in the sidebar footer cell. */
  signOut?: ReactNode
  /** Aktiverade tenant_modules-nycklar (admin-portalen). undefined → ingen
   *  gating (platform/personal); [] → alla modul-poster döljs. */
  activeModuleKeys?: string[]
  /** Rollnivå (roll-separationen): poster med högre minLevel döljs. undefined →
   *  ingen roll-gating. Servern gatar ändå (requireAdminArea) — detta är bara UI. */
  roleLevel?: number
  /** Personliga tillägg (tenant_member_permissions, goal-71): ytor beviljade
   *  UTÖVER rollnivån får en synlig menyväg. Servern är fortfarande sanningen. */
  grantedAreas?: readonly string[]
}) {
  const pathname = usePathname()
  const cfg = NAV[role]
  // Modul- och rollstyrd meny: dölj poster vars modul inte är aktiverad för kunden
  // eller vars minLevel rollen inte når (om ytan inte beviljats personligen),
  // och dölj grupprubriker som blivit tomma.
  const filtered = cfg.items.filter(
    (e) => isGroup(e) || isNavItemVisible(e, { activeModuleKeys, roleLevel, grantedAreas }),
  )
  const items = filtered.filter((e, i) => {
    if (!isGroup(e)) return true
    const next = filtered[i + 1]
    return next !== undefined && !isGroup(next)
  })
  // Collapsible rail (Zivar: "jag vill kunna gömma den men den ska inte bara försvinna
  // när jag klickar onboarda ny kund"). A manual toggle, NEVER an auto-hide — the sidebar
  // stays open on every page (incl. onboarding) so the studio reads as the same connected
  // surface, not a separate place; the operator hides it themselves via the chevron.
  const [collapsed, setCollapsed] = useState(false)
  // Mobil (≤820px): sidomenyn är off-canvas bakom en hamburgare i .portal-mobilebar
  // (Zivar 2026-07-10: "allt krampar ihop sig i toppen"). Stängs på scrim-klick
  // och automatiskt vid navigering (pathname-byte).
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => setMobileOpen(false), [pathname])

  return (
    <>
      <div className="portal-mobilebar">
        <button
          type="button"
          className="portal-mobilebar-burger"
          onClick={() => setMobileOpen(true)}
          aria-label="Öppna menyn"
          aria-expanded={mobileOpen}
        >
          <Icon name="menu" size={20} />
        </button>
        <span className="portal-mobilebar-brand">{brand}</span>
        <span className="portal-mobilebar-sub">{cfg.sub}</span>
      </div>
      {mobileOpen ? (
        <div className="portal-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      ) : null}
      <aside className={`portal-aside${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-open' : ''}`}>
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
        {items.map((entry, i) => {
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
              // prefetch av: menyns alla länkar förhandsladdades annars samtidigt vid
              // varje sidvisning → burst av parallella SSR-renderingar i SAMMA
              // worker-instans → 128 MB-OOM (Cloudflare Error 1102, "exceededResources"
              // med låg CPU). Navigering laddar sidan vid klick i stället.
              prefetch={false}
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
    </>
  )
}
