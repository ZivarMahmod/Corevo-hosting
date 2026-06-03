import type { ReactNode } from 'react'
import { Card } from './Card'
import { Icon, type IconName } from './Icon'

/**
 * Back-office KPI card — big Playfair number in forest, eyebrow label, optional
 * delta line and tinted icon chip. Ported from the design-system handoff
 * (back-office/Shell.jsx). Consumes the [data-world="backoffice"] --c-* tokens
 * and the .eyebrow type role.
 */
export function Stat({
  label,
  value,
  delta,
  deltaTone = 'success',
  icon,
  hint,
}: {
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  deltaTone?: 'success' | 'muted'
  icon?: IconName
  /** Optional caption under the value/delta (playbook §4.2 — e.g. "mot förra veckan"). */
  hint?: ReactNode
}) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="eyebrow">{label}</span>
        {icon && (
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'var(--c-paper-2)',
              color: 'var(--c-forest)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name={icon} size={18} />
          </div>
        )}
      </div>
      <div
        className="num"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 38,
          fontWeight: 700,
          color: 'var(--c-forest)',
          lineHeight: 1.1,
          marginTop: 10,
        }}
      >
        {value}
      </div>
      {delta && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: deltaTone === 'success' ? 'var(--c-success)' : 'var(--c-ink-3)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {deltaTone === 'success' && <Icon name="trendUp" size={15} />}
          {delta}
        </div>
      )}
      {hint && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: 'var(--c-ink-3)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {hint}
        </div>
      )}
    </Card>
  )
}
