import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold'

const TONES: Record<BadgeTone, [bg: string, accent: string]> = {
  neutral: ['var(--c-paper-2)', 'var(--c-ink-3)'],
  success: ['var(--c-success-bg)', 'var(--c-success)'],
  warning: ['var(--c-warning-bg)', 'var(--c-warning)'],
  danger: ['var(--c-danger-bg)', 'var(--c-danger)'],
  info: ['var(--c-info-bg)', 'var(--c-info)'],
  gold: ['var(--c-gold-100)', 'var(--c-gold-600)'],
}

/**
 * Back-office status pill — muted tinted fill + a tone-coloured dot. Ported from
 * the design-system handoff (back-office/Shell.jsx). The neutral tone now reads
 * from --c-paper-2/--c-ink-3 (was a hardcoded grey in the prototype). Consumes the
 * [data-world="backoffice"] --c-* tokens.
 */
export function Badge({
  children,
  tone = 'neutral',
  dot = true,
}: {
  children: ReactNode
  tone?: BadgeTone
  dot?: boolean
}) {
  const [bg, accent] = TONES[tone] ?? TONES.neutral
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        background: bg,
        color: 'var(--c-ink)',
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 11px',
        borderRadius: 999,
        fontFamily: 'var(--font-ui)',
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{ width: 6, height: 6, borderRadius: 999, background: accent, flex: 'none' }}
        />
      )}
      {children}
    </span>
  )
}
