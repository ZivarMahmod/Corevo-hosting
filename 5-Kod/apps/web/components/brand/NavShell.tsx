'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_LINKS } from './NavLinks'
import { BookCta } from './BookCta'
import { UtilityBar } from '@/components/storefront/UtilityBar'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from './nav-shell.module.css'

/**
 * Client chrome shell for the ONE themed storefront nav. Adds the editorial
 * behaviours the static markup can't, correct-by-construction so it's safe without
 * a live build:
 *
 *  - Fixed top cluster (utility strip + nav). SOLID by default (every page, SSR,
 *    first client render, no-JS). Goes TRANSPARENT with light text ONLY when
 *    `hasHero && !scrolled` — i.e. over a full-bleed hero (Salvia only; the other
 *    four layouts have a solid nav in normal flow and emit no `.hero` sentinel).
 *    So non-hero pages and the four non-overlay layouts are never light-on-cream,
 *    and server/first-render always match (no React #418).
 *  - Hamburger + full-screen overlay menu on mobile, with focus-trap + restore.
 *
 * Geometry: the fixed cluster reserves space via `--nav-h` padding on <main>
 * (set in the storefront layouts via a module class); the Salvia hero cancels it
 * with `margin-top: calc(-1 * var(--nav-h))`, so the photo meets the viewport top.
 *
 * Layout (centered vs left/split) is driven purely by the `[data-theme]` ancestor
 * in nav-shell.module.css — NOT by a prop — so this nav renders identically at all
 * three call sites ((public)/layout, boka/layout, avboka/[id]/page), none of which
 * pass a theme. The desktop nav markup is passed as `children` (server-rendered).
 */
export function NavShell({
  children,
  customerAccountsEnabled,
  cartEnabled,
  utilityText,
  hideUtility,
  links,
  primaryCta,
}: {
  children: ReactNode
  customerAccountsEnabled?: boolean
  /** goal-55 7B: shop-modul på → "Varukorg (N)"-rad i mobil-overlayn. */
  cartEnabled?: boolean
  /** Per-theme utility-strip copy; falls back to UtilityBar's default. */
  utilityText?: string
  /** goal-60: temat ritar sin EGEN annonsrad i sitt chrome (mallen äger formen).
      Utan detta renderades BÅDA — plattformens mörka remsa + mallens egna — som
      två staplade rader. Sätts av (public)/layout ur ThemeChrome.ownsUtility. */
  hideUtility?: boolean
  /** Modulstyrda menylänkar (mobil-overlayn); utan prop = NAV_LINKS. */
  links?: readonly { href: string; label: string }[]
  /** goal-55 8A: bransch-styrd huvud-CTA för mobil-overlayn — samma färdig-gatade
      cta som desktop-klustret; null/undefined = BookCta som förr. */
  primaryCta?: { label: string; href: string } | null
}) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [hasHero, setHasHero] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const overlayCloseRef = useRef<HTMLButtonElement>(null)

  // Detect a full-bleed hero below the nav (Salvia home only). Read after mount,
  // so the SSR/first-render state stays SOLID (transparent is purely additive).
  // Re-checked on every client navigation (pathname dep) because the NavShell
  // lives in the shared layout and does NOT remount. Close the mobile menu too.
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
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
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
        scrolled ? shell.scrolled : '',
        transparent ? shell.transparent : shell.solid,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hideUtility ? null : <UtilityBar {...(utilityText ? { text: utilityText } : {})} />}
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
          {(links ?? NAV_LINKS).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {/* goal-55 7B: korg-rad i mobil-overlayn — stänger menyn och öppnar
              /varukorg-sidan (goal-57). */}
          {cartEnabled ? (
            <CartNavButton variant="overlay" tabIndex={menuOpen ? 0 : -1} onOpen={() => setMenuOpen(false)} />
          ) : null}
          {customerAccountsEnabled ? (
            <Link href="/login" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}>
              Logga in
            </Link>
          ) : null}
        </nav>
        <div className={shell.overlayCta} onClick={() => setMenuOpen(false)}>
          {/* goal-55 8A: samma bransch-styrda CTA som desktop-klustret. */}
          {primaryCta && primaryCta.href !== '/boka' ? (
            <Link href={primaryCta.href} className="btn-accent" tabIndex={menuOpen ? 0 : -1}>
              {primaryCta.label}
            </Link>
          ) : (
            <BookCta label={primaryCta?.label} />
          )}
        </div>
      </div>
    </div>
  )
}
