import Link from 'next/link'
import { BookCta } from '@/components/brand/BookCta'
import { Logo } from '@/components/brand/Logo'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeFooterProps, ThemeNavProps } from './florist/types'
import fc from './freshcut.module.css'

const HOME_LINKS = [
  { href: '/#tjanster', label: 'Priser' },
  { href: '/#resultat', label: 'Resultat' },
  { href: '/#salongen', label: 'Salongen' },
  { href: '/#kontakt', label: 'Kontakt' },
] as const

const HOME_ROUTES = new Set(['/', '/tjanster', '/team', '/om', '/kontakt'])

export function freshCutNavigationLinks(
  links: readonly { href: string; label: string }[],
): { href: string; label: string }[] {
  const moduleLinks = links.filter(
    (link) => !HOME_ROUTES.has(link.href) && !link.href.startsWith('/#'),
  )
  return [...HOME_LINKS, ...moduleLinks]
}

function wordmark(name: string) {
  const compact = name.replace(/\s+/g, '')
  if (compact.toLocaleLowerCase('sv-SE') !== 'freshcut') return <>{name}<i>.</i></>
  return <>FRESH<span>CUT</span><i>.</i></>
}

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export function FreshCutNav(p: ThemeNavProps) {
  const navigationLinks = freshCutNavigationLinks(p.links)
  const hasLogo = Boolean(p.branding.logo_url)

  return (
    <>
      <div className={fc.topline}>
        <p>{p.utilityText || 'Barbershop · Linköping City'}</p>
        {p.location?.address || p.contact?.phone ? (
          <p>
            {p.location?.address ? <span>{p.location.address.split(',')[0]}</span> : null}
            {p.location?.address && p.contact?.phone ? <i aria-hidden="true">/</i> : null}
            {p.contact?.phone ? <a href={phoneHref(p.contact.phone)}>{p.contact.phone}</a> : null}
          </p>
        ) : null}
      </div>

      <header className={`${shell.navThemed} ${fc.siteHeader}`}>
        <Link href="/" className={`${shell.navWordmark} ${fc.wordmark}`} aria-label={`${p.tenant.name} – startsida`}>
          {hasLogo ? <Logo tenant={p.tenant} branding={p.branding} /> : wordmark(p.tenant.name)}
        </Link>

        <nav className={`${shell.navLinks} ${fc.desktopNav}`} aria-label="Huvudmeny">
          {navigationLinks.map((link) => (
            <Link key={`${link.href}-${link.label}`} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={`${shell.navCluster} ${fc.navCluster}`}>
          {p.customerAccountsEnabled ? (
            <Link href="/login" className={fc.navIcon} aria-label="Logga in">
              <StorefrontIcon name="user" size={17} />
            </Link>
          ) : null}
          {p.cartEnabled ? <CartNavButton className={fc.navCart} /> : null}
          {p.primaryCta && p.primaryCta.href !== '/boka' ? (
            <Link href={p.primaryCta.href} className={fc.headerBooking}>
              {p.primaryCta.label} <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <BookCta className={fc.headerBooking} label="Bokadirekt →" />
          )}
        </div>
      </header>
    </>
  )
}

export function FreshCutFooter(p: ThemeFooterProps) {
  return (
    <footer className={fc.siteFooter}>
      <Link href="/" className={fc.footerWordmark} aria-label={`${p.tenant.name} – startsida`}>
        {wordmark(p.tenant.name)}
      </Link>
      <p>© {new Date().getFullYear()} {p.tenant.name} · Linköping</p>
      <p>Webb & bokning via Corevo</p>
    </footer>
  )
}
