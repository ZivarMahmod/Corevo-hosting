export type NavLink = { href: string; label: string }

export const NAV_LINKS: readonly NavLink[] = [
  { href: '/', label: 'Hem' },
  { href: '/tjanster', label: 'Tjänster' },
  { href: '/om', label: 'Om oss' },
  { href: '/kontakt', label: 'Kontakt' },
] as const
