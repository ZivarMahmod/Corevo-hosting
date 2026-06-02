import type { ReactNode } from 'react'
import { Icon } from '@/components/portal/ui'

/**
 * "Se din sida" — opens the tenant's PUBLIC storefront in a new tab (M6 §3.6 /
 * §3.8). The shared back-office Button does not support target/rel (and lives
 * outside this revir), so this is a plain anchor reusing the same `.pbtn` classes
 * so it matches the design-system buttons exactly. external = new tab.
 */
export function OpenSiteLink({
  href,
  children,
  variant = 'ghost',
}: {
  href: string
  children: ReactNode
  variant?: 'ghost' | 'subtle' | 'primary'
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`pbtn pbtn--${variant} pbtn--md`}
    >
      <Icon name="link" size={17} />
      {children}
    </a>
  )
}
