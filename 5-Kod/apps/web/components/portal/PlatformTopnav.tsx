'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CommandPalette, type CommandItem } from './ui/CommandPalette'
import { Icon } from './ui/Icon'
import { ThemeSwitch } from './ThemeSwitch'
import {
  PLATFORM_AREAS,
  PLATFORM_SUBNAV,
  activePlatformArea,
  platformPathMatches,
} from './platform-navigation'
import styles from './PlatformTopnav.module.css'

/**
 * Superadmin-only chrome from the 2026-07-13 handoff. It changes navigation and
 * presentation only: every link still lands on the existing server page, DAL and
 * server actions. No prototype state or mock controls cross this boundary.
 */
export function PlatformTopnav({
  paletteItems,
  userLabel,
  email,
  signOut,
}: {
  paletteItems: ReadonlyArray<CommandItem>
  userLabel: string
  email: string
  signOut: ReactNode
}) {
  const pathname = usePathname()
  const activeArea = activePlatformArea(pathname)
  const subnav = PLATFORM_SUBNAV[activeArea.id]
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
        <Link href="/" className={styles.brand} aria-label="Corevo superadmin – översikt">
          <span className={styles.mark} aria-hidden="true">C</span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Corevo</span>
            <span className={styles.brandSub}>Superadmin</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Huvudnavigering">
          {PLATFORM_AREAS.map((area) => {
            const active = area.id === activeArea.id
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
          <Link href="/salonger/ny" className={styles.newCustomer}>
            <Icon name="plus" size={15} />
            <span>Ny kund</span>
          </Link>
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
                <em>Super admin</em>
              </div>
              {signOut}
            </div>
          </details>
        </div>
      </div>

      {subnav ? (
        <div className={styles.subnavWrap}>
          <nav className={styles.subnav} aria-label={`${activeArea.label} – undersidor`}>
            {subnav.map((item) => {
              const active = platformPathMatches(pathname, item.href)
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

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        items={paletteItems}
      />
    </header>
  )
}
