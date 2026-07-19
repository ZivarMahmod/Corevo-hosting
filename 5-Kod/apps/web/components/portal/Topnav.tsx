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
import {
  MOBILE_CALENDAR_DATE_EVENT,
  MOBILE_CALENDAR_META_EVENT,
  MOBILE_CALENDAR_META_REQUEST_EVENT,
  MOBILE_CALENDAR_SHIFT_EVENT,
  MOBILE_HELP_EVENT,
  MOBILE_SEARCH_EVENT,
  type MobileCalendarMeta,
} from './mobile-search-event'

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
  /** Ytan finns men kontot saknar behörighet (Zivar 2026-07-18): visas låst med
   *  hänglås i stället för att döljas, så en frisör/platschef förstår att ytan
   *  existerar och att ägaren kan bevilja den. Servergrinden är kvar orörd. */
  locked?: boolean
}

export type TopnavQuickAction = {
  href: string
  label: string
  icon: IconName
}

export type TopnavMobileNavigation = {
  tabs: readonly TopnavArea[]
  more: readonly TopnavArea[]
  action?: { href: string; label: string }
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

/** Välj den mest specifika undersidan. Roten /admin/installningar matchar annars
 * varje undersida och gav två samtidiga aria-current-markeringar. */
export function activeTopnavSubitem(
  pathname: string,
  items: readonly TopnavItem[],
): TopnavItem | undefined {
  return items
    .filter((item) => topnavPathMatches(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
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
    <div className={`${styles.accountIdentity}${admin ? ` ${adminStyles.accountIdentity}` : ''}`}>
      <strong>{userLabel}</strong>
      <span>
        {email} <b aria-hidden="true">·</b> {roleLabel}
      </span>
    </div>
  )
}

function mobileNavIcon(areaId: string): IconName {
  if (areaId === 'oversikt' || areaId === 'overview') return 'grid'
  if (areaId === 'kalender') return 'calendar'
  if (areaId === 'kunder' || areaId === 'customers') return 'users'
  if (areaId === 'insight') return 'chartBars'
  if (areaId === 'drift') return 'alert'
  return 'menu'
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
  adminMobileChrome = false,
  subnav: subnavByArea,
  paletteItems,
  remoteAdminSearch = false,
  brandHref,
  brandMark,
  brandName,
  brandSub,
  brandLabel,
  primaryAction,
  quickActions,
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
  /** Rollens responsiva omarrangering av samma, redan servergodkända navigation. */
  mobileNavigation?: TopnavMobileNavigation
  /** Kundadminens kanoniska PWA-chrome. Plattformens befintliga mobilnav är separat. */
  adminMobileChrome?: boolean
  /** Subnav per område-id (superadminens befintliga karta). Områdets egen `subnav` vinner. */
  subnav?: Partial<Record<string, readonly TopnavItem[]>>
  paletteItems: ReadonlyArray<CommandItem>
  remoteAdminSearch?: boolean
  brandHref: string
  /** Bokstaven i varumärkesrutan. */
  brandMark: string
  brandName: string
  brandSub: string
  /** aria-label på varumärkeslänken. */
  brandLabel: string
  primaryAction?: { href: string; label: string; icon: IconName }
  /** Genvägsraden (Zivar 2026-07-18): dashboardens genvägar flyttade till bannern som
   *  cirkulära ikonknappar för åtkomst från varje adminyta. Ersätter GENVÄGAR-kortet. */
  quickActions?: readonly TopnavQuickAction[]
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
  const activeSubitem = subnav ? activeTopnavSubitem(pathname, subnav) : undefined
  const mobileAreas = mobileNavigation ? [...mobileNavigation.tabs, ...mobileNavigation.more] : []
  const activeMobileArea = mobileNavigation ? activeTopnavArea(pathname, mobileAreas) : undefined
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false)
  const [mobileHelpOpen, setMobileHelpOpen] = useState(false)
  const [calendarMeta, setCalendarMeta] = useState<MobileCalendarMeta | null>(null)
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
    setMobileHelpOpen(false)
    setCalendarMeta(null)
  }, [pathname])

  useEffect(() => {
    if (!adminMobileChrome) return
    const onCalendarMeta = (event: Event) => {
      setCalendarMeta((event as CustomEvent<MobileCalendarMeta>).detail)
    }
    window.addEventListener(MOBILE_CALENDAR_META_EVENT, onCalendarMeta)
    window.dispatchEvent(new Event(MOBILE_CALENDAR_META_REQUEST_EVENT))
    return () => window.removeEventListener(MOBILE_CALENDAR_META_EVENT, onCalendarMeta)
  }, [adminMobileChrome])

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
    mobileNavigation?.more.some((area) => area.id === activeMobileArea?.id) ?? false
  const mobileContextVisible =
    mobileNavigation?.tabs.some((area) => area.id === activeMobileArea?.id) ?? false
  const isCalendar = adminMobileChrome && pathname.startsWith('/admin/bokningar')
  const mobilePageTitle = isCalendar
    ? (calendarMeta?.title ?? 'Kalender')
    : (activeMobileArea?.label ?? brandName)
  const mobilePageMeta = isCalendar ? calendarMeta?.meta : undefined
  const calendarStepDisabled = calendarMeta?.step === 'month'
  const calendarStepLabel =
    calendarMeta?.step === 'month' ? 'månad' : calendarMeta?.step === 'week' ? 'vecka' : 'dag'

  const openMobileHelp = () => {
    if (isCalendar) window.dispatchEvent(new Event(MOBILE_HELP_EVENT))
    else setMobileHelpOpen(true)
  }

  return (
    <>
      <header
        className={`${styles.header}${mobileNavigation ? ` ${styles.mobileAdmin}` : ''}${adminMobileChrome ? ` ${styles.adminMobileChrome}` : ''}`}
      >
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
          {adminMobileChrome ? (
            isCalendar ? (
              <button
                type="button"
                className={styles.mobilePageTitle}
                onClick={() => window.dispatchEvent(new Event(MOBILE_CALENDAR_DATE_EVENT))}
                aria-label="Välj datum"
              >
                <strong>
                  {mobilePageTitle}
                  <Icon name="chevronDown" size={11} />
                </strong>
                {mobilePageMeta ? <span>{mobilePageMeta}</span> : null}
              </button>
            ) : (
              <span className={styles.mobilePageTitle}>
                <strong>{mobilePageTitle}</strong>
              </span>
            )
          ) : null}

          <nav className={styles.nav} aria-label="Huvudnavigering">
            {areas.map((area) => {
              if (area.locked) {
                return (
                  <span
                    key={area.id}
                    className={`${styles.navLink} ${styles.navLinkLocked}`}
                    aria-disabled="true"
                    title="Kräver behörighet från ägaren"
                  >
                    <Icon name="lock" size={11} />
                    {area.label}
                  </span>
                )
              }
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
            {quickActions?.length ? (
              <nav className={styles.quickGroup} aria-label="Genvägar">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={styles.quickTab}
                    aria-label={action.label}
                    title={action.label}
                  >
                    <Icon name={action.icon} size={16} />
                  </Link>
                ))}
              </nav>
            ) : null}
            <button
              type="button"
              className={`${styles.search}${mobileNavigation ? ` ${adminStyles.search}` : ''}`}
              onClick={openCommandPalette}
              aria-label="Sök kund, bokning eller sida"
              aria-haspopup="dialog"
              title={`Sök (${isMac ? '⌘' : 'Ctrl'} K)`}
            >
              <Icon name="search" size={16} />
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

          {mobileNavigation && adminMobileChrome ? (
            <div className={styles.mobileActions}>
              <button
                type="button"
                className={styles.mobileHelp}
                onClick={openMobileHelp}
                aria-label="Hjälp för den här sidan"
              >
                <Icon name="help" size={19} stroke={1.7} />
                <span>Hjälp</span>
              </button>
            </div>
          ) : mobileNavigation ? (
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
                const active = activeSubitem?.href === item.href
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

        {mobileNavigation && adminMobileChrome ? (
          <>
            {mobileContextVisible ? (
              <nav className={styles.mobileContext} aria-label="Sidåtgärder">
                {isCalendar ? (
                  <>
                    <button
                      type="button"
                      className={styles.mobileContextAction}
                      onClick={() => window.dispatchEvent(new Event(MOBILE_SEARCH_EVENT))}
                    >
                      <Icon name="search" size={19} stroke={1.7} />
                      <span>Sök</span>
                    </button>
                    <Link className={styles.mobileContextAction} href="/admin/bokningar?ny=1">
                      <Icon name="plus" size={19} stroke={1.7} />
                      <span>Ny bokning</span>
                    </Link>
                    <Link
                      className={`${styles.mobileContextAction} ${styles.mobileContextWarning}`}
                      href="/admin/bokningar?blockera=1"
                    >
                      <Icon name="clock" size={19} stroke={1.7} />
                      <span>Blockera</span>
                    </Link>
                    <button
                      type="button"
                      className={`${styles.mobileContextAction} ${styles.mobileRailNext}`}
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent(MOBILE_CALENDAR_SHIFT_EVENT, { detail: 1 }),
                        )
                      }
                      disabled={calendarStepDisabled}
                      aria-label={`Nästa ${calendarStepLabel}${calendarMeta?.next && !calendarStepDisabled ? `, ${calendarMeta.next}` : ''}`}
                    >
                      <Icon name="chevronRight" size={20} stroke={1.7} />
                      <span>{calendarMeta?.next ?? 'Nästa'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.mobileContextAction}
                      onClick={openCommandPalette}
                    >
                      <Icon name="search" size={19} stroke={1.7} />
                      <span>Sök</span>
                    </button>
                    {activeMobileArea?.id === 'kunder' ? (
                      <Link className={styles.mobileContextAction} href="/admin/kunder?ny=1">
                        <Icon name="plus" size={19} stroke={1.7} />
                        <span>Ny kund</span>
                      </Link>
                    ) : null}
                  </>
                )}
              </nav>
            ) : null}

            <nav className={styles.mobileNav} aria-label="Mobilnavigering">
              {mobileNavigation.tabs.slice(0, 3).map((area) => {
                const active = area.id === activeMobileArea?.id
                return (
                  <Link
                    key={area.id}
                    href={area.href}
                    className={`${styles.mobileNavItem}${active ? ` ${styles.mobileNavItemActive}` : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon
                      className={`${styles.mobileNavIcon} ${adminStyles.mobileNavIcon}`}
                      name={mobileNavIcon(area.id)}
                      size={19}
                      stroke={1.7}
                    />
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
                <Icon
                  className={`${styles.mobileNavIcon} ${adminStyles.mobileNavIcon}`}
                  name={mobileNavIcon('more')}
                  size={19}
                  stroke={1.7}
                />
                <span>Mer</span>
              </button>
              {isCalendar ? (
                <button
                  type="button"
                  className={`${styles.mobileNavItem} ${styles.mobileRailPrevious}`}
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent(MOBILE_CALENDAR_SHIFT_EVENT, { detail: -1 }),
                    )
                  }
                  disabled={calendarStepDisabled}
                  aria-label={`Föregående ${calendarStepLabel}${calendarMeta?.previous && !calendarStepDisabled ? `, ${calendarMeta.previous}` : ''}`}
                >
                  <Icon name="chevronLeft" size={20} stroke={1.7} />
                  <span>{calendarMeta?.previous ?? 'Föregående'}</span>
                </button>
              ) : null}
            </nav>
          </>
        ) : mobileNavigation ? (
          <nav
            className={`${styles.mobileNav}${mobileNavigation.tabs.length > 3 ? ` ${styles.mobileNavSixCol}` : ''}`}
            aria-label="Mobilnavigering"
          >
            {mobileNavigation.tabs.slice(0, 2).map((area) => {
              const active = area.id === activeMobileArea?.id
              return (
                <Link
                  key={area.id}
                  href={area.href}
                  className={`${styles.mobileNavItem}${active ? ` ${styles.mobileNavItemActive}` : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className={`${styles.mobileNavIcon} ${adminStyles.mobileNavIcon}`}
                    aria-hidden="true"
                  >
                    <Icon name={mobileNavIcon(area.id)} size={18} />
                  </span>
                  <span>{area.label}</span>
                </Link>
              )
            })}
            {mobileNavigation.action ? (
              <Link
                href={mobileNavigation.action.href}
                className={styles.platformMobileFab}
                aria-label={mobileNavigation.action.label}
              >
                <span className={styles.platformMobileFabButton} aria-hidden="true">
                  <Icon name="plus" size={20} />
                </span>
                <span className={styles.platformMobileFabLabel}>
                  {mobileNavigation.action.label}
                </span>
              </Link>
            ) : null}
            {mobileNavigation.tabs.slice(2).map((area) => {
              const active = area.id === activeMobileArea?.id
              return (
                <Link
                  key={area.id}
                  href={area.href}
                  className={`${styles.mobileNavItem}${active ? ` ${styles.mobileNavItemActive}` : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className={`${styles.mobileNavIcon} ${adminStyles.mobileNavIcon}`}
                    aria-hidden="true"
                  >
                    <Icon name={mobileNavIcon(area.id)} size={18} />
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
              <span
                className={`${styles.mobileNavIcon} ${adminStyles.mobileNavIcon}`}
                aria-hidden="true"
              >
                <Icon name={mobileNavIcon('more')} size={18} />
              </span>
              <span>Mer</span>
            </button>
          </nav>
        ) : null}

        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          items={paletteItems}
          remoteAdminSearch={remoteAdminSearch}
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
              if (area.locked) {
                return (
                  <div key={area.id} className={styles.mobileMoreGroup}>
                    <span
                      className={`${styles.mobileMoreLink} ${styles.mobileMoreLinkLocked}`}
                      aria-disabled="true"
                      title="Kräver behörighet från ägaren"
                    >
                      <span>{area.label}</span>
                      <Icon name="lock" size={15} />
                    </span>
                  </div>
                )
              }
              const active = area.id === activeMobileArea?.id
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
                        const itemActive = activeSubitem?.href === item.href
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
            <button
              type="button"
              className={styles.mobileMoreAccountLink}
              onClick={openMobileAccount}
            >
              <span>Konto</span>
              <Icon name="chevronRight" size={17} />
            </button>
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
        <Modal title="Konto" ariaLabel="Kontomeny" onClose={() => setMobileAccountOpen(false)}>
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

      {mobileNavigation && adminMobileChrome && mobileHelpOpen ? (
        <Modal title="Hjälp" ariaLabel="Hjälp för admin" onClose={() => setMobileHelpOpen(false)}>
          <div className={styles.mobileHelpBody}>
            <p>
              Sidans viktigaste åtgärder finns i raden ovanför huvudmenyn. I liggande telefonläge
              flyttas samma val ut till sidornas räcken för att ge innehållet full höjd.
            </p>
            <p>
              Konto, inställningar och övriga moduler finns under <strong>Mer</strong>.
            </p>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
