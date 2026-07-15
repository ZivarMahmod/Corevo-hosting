'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CommandPalette, type CommandItem } from './ui/CommandPalette'
import { Icon, type IconName } from './ui/Icon'
import { Modal } from './ui/Modal'
import { ThemeSwitch } from './ThemeSwitch'
import styles from './Topnav.module.css'
import adminStyles from './AdminTopnav.module.css'
import { closePortalDetails, useDismissibleDetails } from './useDismissibleDetails'

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

export type TopnavMobileNavigation = {
  tabs: readonly TopnavArea[]
  more: readonly TopnavArea[]
  action: { href: string; label: string }
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

function AccountIdentity({
  userLabel,
  email,
  roleLabel,
  admin = false,
}: {
  userLabel: string
  email: string
  roleLabel: string
  admin?: boolean
}) {
  return (
    <div
      className={`${styles.accountIdentity}${admin ? ` ${adminStyles.accountIdentity}` : ''}`}
    >
      <strong>{userLabel}</strong>
      <span>
        {email} <b aria-hidden="true">·</b> {roleLabel}
      </span>
    </div>
  )
}

function mobileNavGlyph(areaId: string) {
  if (areaId === 'oversikt') return '▦'
  if (areaId === 'kalender') return '▤'
  if (areaId === 'kunder') return '◉'
  return '≡'
}

function AccountLinks({
  items,
  mobile = false,
  onNavigate,
}: {
  items: readonly TopnavItem[]
  mobile?: boolean
  onNavigate?: () => void
}) {
  return (
    <div
      className={`${adminStyles.accountLinks}${mobile ? ` ${adminStyles.accountLinksMobile}` : ''}`}
    >
      {items.map((item) =>
        item.href.startsWith('/') ? (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            {item.label}
          </Link>
        ) : (
          <a key={item.href} href={item.href} onClick={onNavigate}>
            {item.label}
          </a>
        ),
      )}
    </div>
  )
}

export function Topnav({
  areas,
  mobileNavigation,
  subnav: subnavByArea,
  paletteItems,
  brandHref,
  brandMark,
  brandName,
  brandSub,
  brandLabel,
  primaryAction,
  contextLink,
  themeVariant = 'segmented',
  accountLinks,
  extra,
  userLabel,
  email,
  roleLabel,
  signOut,
}: {
  areas: readonly TopnavArea[]
  /** Kund-adminens responsiva omarrangering. Utebliven för plattformen. */
  mobileNavigation?: TopnavMobileNavigation
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
  /** Toppbannerens temakontroll: tre direktval eller kanonens kompakta cykelknapp. */
  themeVariant?: 'segmented' | 'cycle'
  /** Rollspecifika kontolänkar; toppnaven äger bara presentationen. */
  accountLinks?: readonly TopnavItem[]
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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const accountRef = useRef<HTMLDetailsElement>(null)
  const onAccountToggle = useDismissibleDetails(accountRef)
  const initial = (userLabel.charAt(0) || email.charAt(0) || 'C').toUpperCase()

  const closeDesktopAccount = useCallback(() => {
    if (accountRef.current) accountRef.current.open = false
  }, [])

  const openCommandPalette = useCallback(() => {
    closePortalDetails()
    setMobileMoreOpen(false)
    setMobileAccountOpen(false)
    setCommandOpen(true)
  }, [])

  const openMobileMore = useCallback(() => {
    closePortalDetails()
    setCommandOpen(false)
    setMobileAccountOpen(false)
    setMobileMoreOpen(true)
  }, [])

  const openMobileAccount = useCallback(() => {
    closePortalDetails()
    setCommandOpen(false)
    setMobileMoreOpen(false)
    setMobileAccountOpen(true)
  }, [])

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ''))
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (commandOpen) setCommandOpen(false)
        else openCommandPalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [commandOpen, openCommandPalette])

  useEffect(() => {
    closePortalDetails()
    setCommandOpen(false)
    setMobileMoreOpen(false)
    setMobileAccountOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileNavigation) return

    const desktop = window.matchMedia('(min-width: 768px)')
    const closeMobileSurfaces = ({ matches }: Pick<MediaQueryList, 'matches'>) => {
      if (!matches) return
      setMobileMoreOpen(false)
      setMobileAccountOpen(false)
    }

    closeMobileSurfaces(desktop)
    desktop.addEventListener('change', closeMobileSurfaces)
    return () => desktop.removeEventListener('change', closeMobileSurfaces)
  }, [mobileNavigation])

  const mobileMoreActive =
    mobileNavigation?.more.some((area) => area.id === activeArea?.id) ?? false

  return (
    <>
      <header className={`${styles.header}${mobileNavigation ? ` ${styles.mobileAdmin}` : ''}`}>
        <div className={styles.bar}>
          <Link href={brandHref} className={styles.brand} aria-label={brandLabel}>
            <span className={styles.mark} aria-hidden="true">
              {brandMark}
            </span>
            <span className={styles.brandText}>
              <span
                className={`${styles.brandName}${mobileNavigation ? ` ${adminStyles.brandName}` : ''}`}
              >
                {brandName}
              </span>
              <span
                className={`${styles.brandSub}${mobileNavigation ? ` ${adminStyles.brandSub}` : ''}`}
              >
                {brandSub}
              </span>
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
              className={`${styles.search}${mobileNavigation ? ` ${adminStyles.search}${extra ? ` ${adminStyles.searchWithExtra}` : ''}` : ''}`}
              onClick={openCommandPalette}
              aria-label="Sök kund, bokning eller sida"
              aria-haspopup="dialog"
            >
              <Icon name="search" size={15} />
              <span className={styles.searchText}>Sök kund, bokning…</span>
              <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
            </button>
            {primaryAction ? (
              <Link href={primaryAction.href} className={styles.newCustomer}>
                <Icon name={primaryAction.icon} size={15} />
                <span>{primaryAction.label}</span>
              </Link>
            ) : null}
            {extra ? <div className={styles.extra}>{extra}</div> : null}
            {contextLink ? (
              <a
                href={contextLink.href}
                className={styles.context}
                target="_blank"
                rel="noreferrer"
              >
                <span className={styles.contextWide}>{contextLink.label}</span>
                <span className={adminStyles.contextCompact}>Min sida</span>
                <Icon name="external" size={14} />
              </a>
            ) : null}
            <div className={`${styles.theme} ${adminStyles.theme}`}>
              <ThemeSwitch variant={themeVariant} />
            </div>
            <details
              ref={accountRef}
              className={styles.account}
              data-portal-details
              onToggle={onAccountToggle}
            >
              <summary aria-label="Öppna kontomeny" title={userLabel}>
                {initial}
              </summary>
              <div
                className={`${styles.accountMenu}${accountLinks?.length ? ` ${adminStyles.accountMenu}` : ''}`}
              >
                <AccountIdentity
                  userLabel={userLabel}
                  email={email}
                  roleLabel={roleLabel}
                  admin={Boolean(accountLinks?.length)}
                />
                {accountLinks?.length ? (
                  <AccountLinks items={accountLinks} onNavigate={closeDesktopAccount} />
                ) : null}
                {signOut}
              </div>
            </details>
          </div>

          {mobileNavigation ? (
            <div className={styles.mobileActions}>
              <button
                type="button"
                className={styles.mobileSearch}
                onClick={openCommandPalette}
                aria-label="Sök kund, bokning eller sida"
                aria-haspopup="dialog"
              >
                <Icon name="search" size={17} />
              </button>
              <button
                type="button"
                className={styles.mobileAccount}
                onClick={openMobileAccount}
                aria-label="Öppna kontomeny"
                aria-haspopup="dialog"
              >
                {initial}
              </button>
            </div>
          ) : null}
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

        {mobileNavigation ? (
          <nav className={styles.mobileNav} aria-label="Mobilnavigering">
            {mobileNavigation.tabs.slice(0, 2).map((area) => {
              const active = area.id === activeArea?.id
              return (
                <Link
                  key={area.id}
                  href={area.href}
                  className={`${styles.mobileNavItem}${active ? ` ${styles.mobileNavItemActive}` : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={adminStyles.mobileNavIcon} aria-hidden="true">
                    {mobileNavGlyph(area.id)}
                  </span>
                  <span>{area.label}</span>
                </Link>
              )
            })}
            <Link
              href={mobileNavigation.action.href}
              className={styles.mobileFab}
              aria-label={mobileNavigation.action.label}
            >
              <span className={styles.mobileFabButton} aria-hidden="true">
                <Icon name="plus" size={20} />
              </span>
              <span className={styles.mobileFabLabel}>{mobileNavigation.action.label}</span>
            </Link>
            {mobileNavigation.tabs.slice(2).map((area) => {
              const active = area.id === activeArea?.id
              return (
                <Link
                  key={area.id}
                  href={area.href}
                  className={`${styles.mobileNavItem}${active ? ` ${styles.mobileNavItemActive}` : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={adminStyles.mobileNavIcon} aria-hidden="true">
                    {mobileNavGlyph(area.id)}
                  </span>
                  <span>{area.label}</span>
                </Link>
              )
            })}
            <button
              type="button"
              className={`${styles.mobileNavItem}${mobileMoreActive ? ` ${styles.mobileNavItemActive}` : ''}`}
              onClick={openMobileMore}
              aria-label="Fler adminytor"
              aria-haspopup="dialog"
              aria-current={mobileMoreActive ? 'page' : undefined}
            >
              <span className={adminStyles.mobileNavIcon} aria-hidden="true">
                {mobileNavGlyph('more')}
              </span>
              <span>Mer</span>
            </button>
          </nav>
        ) : null}

        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          items={paletteItems}
        />
      </header>

      {mobileNavigation && mobileMoreOpen ? (
        <Modal
          title="Mer"
          ariaLabel="Fler adminytor och verktyg"
          onClose={() => setMobileMoreOpen(false)}
        >
          <nav className={styles.mobileMoreLinks} aria-label="Fler adminytor">
            {mobileNavigation.more.map((area) => {
              const active = area.id === activeArea?.id
              return (
                <div key={area.id} className={styles.mobileMoreGroup}>
                  <Link
                    href={area.href}
                    className={`${styles.mobileMoreLink}${active ? ` ${styles.mobileMoreLinkActive}` : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileMoreOpen(false)}
                  >
                    <span>{area.label}</span>
                    <Icon name="chevronRight" size={17} />
                  </Link>
                  {active && area.subnav ? (
                    <div className={styles.mobileMoreSubnav}>
                      {area.subnav.map((item) => {
                        const itemActive = topnavPathMatches(pathname, item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={itemActive ? 'page' : undefined}
                            onClick={() => setMobileMoreOpen(false)}
                          >
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </nav>

          <div className={styles.mobileMoreTools}>
            {contextLink ? (
              <a href={contextLink.href} target="_blank" rel="noreferrer">
                <span>{contextLink.label}</span>
                <Icon name="external" size={17} />
              </a>
            ) : null}
            {extra ? <div className={styles.mobileMoreExtra}>{extra}</div> : null}
            <div className={`${styles.mobileMoreTheme} ${adminStyles.theme}`}>
              <span>Tema</span>
              <ThemeSwitch variant={themeVariant} />
            </div>
          </div>

        </Modal>
      ) : null}

      {mobileNavigation && mobileAccountOpen ? (
        <Modal
          title="Konto"
          ariaLabel="Kontomeny"
          onClose={() => setMobileAccountOpen(false)}
        >
          <div className={styles.mobileMoreAccount}>
            <AccountIdentity userLabel={userLabel} email={email} roleLabel={roleLabel} admin />
            {accountLinks?.length ? (
              <AccountLinks
                items={accountLinks}
                mobile
                onNavigate={() => setMobileAccountOpen(false)}
              />
            ) : null}
            {signOut}
          </div>
        </Modal>
      ) : null}
    </>
  )
}
