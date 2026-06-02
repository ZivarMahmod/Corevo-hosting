import type { CSSProperties, ReactNode } from 'react'

/**
 * Back-office surface card — paper on cream, hairline border, soft forest-tinted
 * shadow. Ported from the design-system handoff (back-office/Shell.jsx). Consumes
 * the [data-world="backoffice"] --c-* tokens (set by the back-office layouts), so
 * it MUST be rendered inside a back-office shell. `pad={0}` for full-bleed cards
 * (tables, list cards) that manage their own internal padding.
 */
export function Card({
  children,
  style = {},
  pad = 22,
  className = '',
}: {
  children: ReactNode
  style?: CSSProperties
  pad?: number
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--c-paper)',
        border: '1px solid var(--c-line)',
        borderRadius: 16,
        padding: pad,
        boxShadow: 'var(--shadow-sm)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
