import Link from 'next/link'

export type NavLink = { href: string; label: string }

export const NAV_LINKS: readonly NavLink[] = [
  { href: '/', label: 'Hem' },
  { href: '/tjanster', label: 'Tjänster' },
  { href: '/om', label: 'Om oss' },
  { href: '/kontakt', label: 'Kontakt' },
] as const

export function NavLinks() {
  return (
    <nav className="nav-links" aria-label="Huvudmeny">
      {NAV_LINKS.map((l) => (
        <Link key={l.href} href={l.href}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
