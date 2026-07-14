'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CommandPalette, type CommandItem } from './ui/CommandPalette'
import { Icon, type IconName } from './ui/Icon'
import { ThemeSwitch } from './ThemeSwitch'
import styles from './Topnav.module.css'

/**
 * Back-office-skalet från 2026-07-13-handoffen. Var superadmin-only (PlatformTopnav);
 * sedan goal-65 delas det med kund-adminen — samma komposition, samma CSS, samma tokens.
 * Det som skiljer rollerna kommer in som props, aldrig som en ny stilvariant: kund-admin
 * och superadmin ska tillhöra samma produktfamilj (låst beslut codex/00 §1).
 *
 * Skalet ändrar bara navigation och presentation: varje länk landar fortfarande på samma
 * serversida, DAL och server action. Ingen auktorisation bor här — den ligger kvar i
 * requirePortal() och RLS.
 */

export type TopnavItem = {
  href: string
  label: string
}

export type TopnavArea = TopnavItem & {
  id: string
  /** Pathnames som gör området aktivt. */
  prefixes: readonly string[]
  /** Sant för ett område vars href är prefix till syskonens (/admin hade annars matchat
   *  /admin/kunder också). '/' behandlas alltid som exakt. */
  exact?: boolean
  /** Undernavigation. Superadmin bär sin i PLATFORM_SUBNAV; kund-admin på området självt. */
  subnav?: readonly TopnavItem[]
}

export function topnavPathMatches(pathname: string, prefix: string, exact = false): boolean {
  if (exact || prefix === '/') return pathname === prefix
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function activeTopnavArea(
  pathname: string,
  areas: readonly TopnavArea[],
): TopnavArea | undefined {
  return areas.find((area) =>
    area.prefixes.some((prefix) => topnavPathMatches(pathname, prefix, area.exact)),
  )
}

export function Topnav({
  areas,
  subnav: subnavByArea,
  paletteItems,
  brandHref,
  brandMark,
  brandName,
  brandSub,
  brandLabel,
  primaryAction,
  contextLink,
  extra,
  userLabel,
  email,
  roleLabel,
  signOut,
}: {
  areas: readonly TopnavArea[]
  /** Subnav per område-id (superadminens befintliga karta). Områdets egen `subnav` vinner. */
  subnav?: Partial<Record<string, readonly TopnavItem[]>>
  paletteItems: ReadonlyArray<CommandItem>
  brandHref: string
  /** Bokstaven i varumärkesrutan. */
  brandMark: string
  brandName: string
  brandSub: string
  /** aria-label på varumärkeslänken. */
  brandLabel: string
  primaryAction?: { href: string; label: string; icon: IconName }
  /** "Öppna min sida" — kund-adminens publika sajt. Superadmin har ingen enskild storefront. */
  contextLink?: { href: string; label: string }
  /** Platsväljare e.d. Renderas före tema-switchen. */
  extra?: ReactNode
  userLabel: string
  email: string
  roleLabel: string
  signOut: ReactNode
}) {
  const pathname = usePathname()
  const activeArea = activeTopnavArea(pathname, areas) ?? areas[0]
  const subnav = activeArea ? (activeArea.subnav ?? subnavByArea?.[activeArea.id]) : undefined
  const [commandOpen, setCommandOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const accountRef = useRef<HTMLDetailsElement>(null)
  const initial = (userLabel.charAt(0) || email.charAt(0) || 'C').toUpperCase()

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ''))
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
      if (event.key === 'Escape' && accountRef.current?.open) {
        accountRef.current.open = false
        accountRef.current.querySelector('summary')?.focus()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const account = accountRef.current
      if (account?.open && !account.contains(event.target as Node)) account.open = false
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  useEffect(() => {
    if (accountRef.current) accountRef.current.open = false
  }, [pathname])

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href={brandHref} className={styles.brand} aria-label={brandLabel}>
          <span className={styles.mark} aria-hidden="true">
            {brandMark}
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>{brandName}</span>
            <span className={styles.brandSub}>{brandSub}</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Huvudnavigering">
          {areas.map((area) => {
            const active = area.id === activeArea?.id
            return (
              <Link
                key={area.id}
                href={area.href}
                className={`${styles.navLink}${active ? ` ${styles.navLinkActive}` : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {area.label}
              </Link>
            )
          })}
        </nav>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.search}
            onClick={() => setCommandOpen(true)}
            aria-label="Sök sida eller åtgärd"
            aria-haspopup="dialog"
          >
            <Icon name="search" size={15} />
            <span className={styles.searchText}>Sök…</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          {primaryAction ? (
            <Link href={primaryAction.href} className={styles.newCustomer}>
              <Icon name={primaryAction.icon} size={15} />
              <span>{primaryAction.label}</span>
            </Link>
          ) : null}
          {contextLink ? (
            <a href={contextLink.href} className={styles.context} target="_blank" rel="noreferrer">
              <span>{contextLink.label}</span>
              <Icon name="link" size={14} />
            </a>
          ) : null}
          {extra ? <div className={styles.extra}>{extra}</div> : null}
          <div className={styles.theme}>
            <ThemeSwitch />
          </div>
          <details ref={accountRef} className={styles.account}>
            <summary aria-label="Öppna kontomeny" title={userLabel}>
              {initial}
            </summary>
            <div className={styles.accountMenu}>
              <div className={styles.accountIdentity}>
                <strong>{userLabel}</strong>
                <span>{email}</span>
                <em>{roleLabel}</em>
              </div>
              {signOut}
            </div>
          </details>
        </div>
      </div>

      {subnav ? (
        <div className={styles.subnavWrap}>
          <nav className={styles.subnav} aria-label={`${activeArea?.label} – undersidor`}>
            {subnav.map((item) => {
              const active = topnavPathMatches(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.subnavLink}${active ? ` ${styles.subnavLinkActive}` : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      ) : null}

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} items={paletteItems} />
    </header>
  )
}
