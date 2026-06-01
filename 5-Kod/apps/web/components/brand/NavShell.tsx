'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_LINKS } from './NavLinks'
import { BookCta } from './BookCta'
import { UtilityBar } from '@/components/storefront/UtilityBar'
import shell from './nav-shell.module.css'

/**
 * Client shell shared by Nav A/B/C. Adds the editorial behaviours the static
 * global nav can't, correct-by-construction so it's safe without a live build:
 *
 *  - Fixed top cluster (utility strip + nav). SOLID by default (every page, SSR,
 *    first client render, no-JS). Goes TRANSPARENT with light text ONLY when
 *    `hasHero && !scrolled` — so non-hero pages (tjanster/om/kontakt) are never
 *    light-on-cream, and server/first-render always match (no React #418).
 *  - Hamburger + full-screen overlay menu on mobile.
 *
 * Geometry: the fixed cluster reserves space via `--nav-h` padding on <main>
 * (set in (public)/layout via a module class); the home hero cancels it with a
 * negative margin of exactly `-var(--nav-h)`, so the photo meets the viewport
 * top under the nav with nothing to hand-measure.
 *
 * The desktop nav markup (logo + links + CTA) is passed as `children` and stays
 * fully server-rendered.
 */
export function NavShell({
  children,
  variant,
  customerAccountsEnabled,
}: {
  children: ReactNode
  variant: 'A' | 'B' | 'C'
  customerAccountsEnabled?: boolean
}) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [hasHero, setHasHero] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Detect a full-bleed hero below the nav (home page only). Read after mount,
  // so the SSR/first-render state stays SOLID (transparent is purely additive).
  // Re-checked on every client navigation (pathname dep) because the NavShell
  // lives in the shared layout and does NOT remount — without this, going from
  // home (hero) to /tjanster (no hero) would leave the nav transparent =
  // white-on-cream. Close the mobile menu on navigation too.
  useEffect(() => {
    setHasHero(!!document.querySelector('.hero'))
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock scroll while the mobile overlay is open.
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const transparent = hasHero && !scrolled

  return (
    <div
      className={[
        shell.root,
        shell[`v${variant}`],
        scrolled ? shell.scrolled : '',
        transparent ? shell.transparent : shell.solid,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <UtilityBar />
      <div className={shell.navRow}>
        {children}

        {/* Mobile hamburger — only shown ≤720px via CSS. */}
        <button
          type="button"
          className={shell.burger}
          aria-label="Öppna meny"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      {/* Full-screen overlay menu */}
      <div
        className={`${shell.overlay} ${menuOpen ? shell.overlayOpen : ''}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className={shell.overlayClose}
          aria-label="Stäng meny"
          tabIndex={menuOpen ? 0 : -1}
          onClick={() => setMenuOpen(false)}
        >
          <span aria-hidden="true">✕</span>
        </button>
        <nav className={shell.overlayLinks} aria-label="Mobilmeny">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {customerAccountsEnabled ? (
            <Link href="/login" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}>
              Logga in
            </Link>
          ) : null}
        </nav>
        <div className={shell.overlayCta} onClick={() => setMenuOpen(false)}>
          <BookCta />
        </div>
      </div>
    </div>
  )
}
