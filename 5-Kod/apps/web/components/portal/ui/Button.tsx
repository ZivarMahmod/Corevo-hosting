import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type ButtonVariant = 'primary' | 'gold' | 'ghost' | 'subtle'
export type ButtonSize = 'sm' | 'md'

/**
 * Back-office button — forest primary, gold accent, ghost (outline) and subtle
 * fills. Ported from the design-system handoff (back-office/Shell.jsx). Hover is
 * handled in CSS (app/portal-global.css, .pbtn--* scoped under
 * [data-world="backoffice"]) instead of the prototype's JS handlers, so the button
 * works in server components. Renders an <a> (via next/link) when `href` is given,
 * otherwise a <button>. Consumes the back-office --c-* tokens.
 */
export function Button({
  children,
  variant = 'primary',
  icon,
  href,
  type,
  disabled,
  size = 'md',
  style = {},
  className = '',
}: {
  children: ReactNode
  variant?: ButtonVariant
  icon?: IconName
  href?: string
  type?: 'button' | 'submit'
  disabled?: boolean
  size?: ButtonSize
  style?: CSSProperties
  className?: string
}) {
  const cls = `pbtn pbtn--${variant} pbtn--${size}${className ? ` ${className}` : ''}`
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {inner}
      </Link>
    )
  }
  return (
    <button
      className={cls}
      type={type ?? 'button'}
      disabled={disabled}
      style={style}
    >
      {inner}
    </button>
  )
}
