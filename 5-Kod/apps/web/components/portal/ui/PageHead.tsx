import type { ReactNode } from 'react'

/**
 * Back-office page header — optional gold eyebrow + Playfair H1, with an optional
 * actions slot pushed to the right. Ported from the design-system handoff
 * (back-office/Shell.jsx). Consumes the [data-world="backoffice"] .eyebrow + .h1
 * type roles.
 */
export function PageHead({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  /** Optional calm one-liner under the H1 (back-office "du" voice). */
  lede?: ReactNode
  children?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 20,
        flexWrap: 'wrap',
        marginBottom: 26,
      }}
    >
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="h1" style={{ margin: eyebrow ? '8px 0 0' : 0 }}>
          {title}
        </h1>
        {lede && (
          <p className="body" style={{ margin: '8px 0 0', maxWidth: 580 }}>
            {lede}
          </p>
        )}
      </div>
      {children && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}
