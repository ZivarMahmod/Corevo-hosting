import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type CalloutTone = 'warning' | 'success' | 'info' | 'gold'

/** tone → [tint bg, leading-icon colour, default icon] (playbook §4.7) */
const TONES: Record<CalloutTone, { bg: string; color: string; icon: IconName }> = {
  warning: { bg: 'var(--c-warning-bg)', color: 'var(--c-warning)', icon: 'alert' },
  success: { bg: 'var(--c-success-bg)', color: 'var(--c-success)', icon: 'checkCircle' },
  info: { bg: 'var(--c-info-bg)', color: 'var(--c-info)', icon: 'info' },
  gold: { bg: 'var(--c-gold-100)', color: 'var(--c-gold-600)', icon: 'link' },
}

/**
 * Back-office callout / guard-band (playbook §4.7 — "produkten berättar om sig
 * själv"). A leading tone-icon + a one-line explainer + an optional inline action.
 * Used ~10 places: dirty/published state, no-show guard, "testad & fungerar",
 * schema-preset/auto-klar info, live-koppling hints. Sits between PageHead and
 * body, or inline inside a drawer. Server-safe (no client hooks); consumes the
 * [data-world="backoffice"] --c-*-bg / --c-* status tokens.
 */
export function Callout({
  tone = 'info',
  icon,
  children,
  action,
  role = 'status',
}: {
  tone?: CalloutTone
  /** Override the default tone icon. */
  icon?: IconName
  children: ReactNode
  /** Optional inline action pushed to the right (e.g. a small Button or link). */
  action?: ReactNode
  /** ARIA live role — 'status' (default) or 'alert' for genuinely urgent bands. */
  role?: 'status' | 'alert'
}) {
  const t = TONES[tone] ?? TONES.info
  return (
    <div
      role={role}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '12px 16px',
        borderRadius: 12,
        background: t.bg,
        fontFamily: 'var(--font-ui)',
      }}
    >
      <span style={{ color: t.color, flex: 'none', display: 'grid', placeItems: 'center' }}>
        <Icon name={icon ?? t.icon} size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--c-ink)' }}>
        {children}
      </span>
      {action && <span style={{ flex: 'none' }}>{action}</span>}
    </div>
  )
}
