'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  const burgerRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const overlayCloseRef = useRef<HTMLButtonElement>(null)

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

  // While the mobile overlay is open: lock scroll, move focus in, trap Tab inside
  // the overlay, close on Escape, and restore focus to the burger on close.
  // Mirrors BookingDrawer's dialog a11y; focus is restored to the known trigger
  // (burgerRef) rather than document.activeElement, which a <button> click does
  // not reliably focus in every browser.
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Move focus into the overlay after it paints, so the trap has something to
    // hold (the burger sits outside the overlay and stays focusable otherwise).
    const t = window.setTimeout(() => overlayCloseRef.current?.focus(), 0)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      const overlay = overlayRef.current
      if (!overlay) return
      const focusables = overlay.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      burgerRef.current?.focus()
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
          ref={burgerRef}
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
        ref={overlayRef}
        className={`${shell.overlay} ${menuOpen ? shell.overlayOpen : ''}`}
        aria-hidden={!menuOpen}
      >
        <button
          ref={overlayCloseRef}
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
