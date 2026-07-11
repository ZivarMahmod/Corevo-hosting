import type { ReactNode } from 'react'
import { Card } from './Card'
import { Icon, type IconName } from './Icon'

/** Normerat tomt läge för admin-modulernas listor (goal-55 steg 1).
 *  Utan ikon = Shop/Blogg-mönstret (eyebrow-rubrik + brödtext i ett Card);
 *  med ikon = OffertInbox-varianten (centrerad glyf ovanför texten). */
export function EmptyState({
  icon,
  title,
  text,
}: {
  icon?: IconName
  title: string
  text?: ReactNode
}) {
  if (icon) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--c-ink-2)' }}>
          <Icon name={icon} size={32} style={{ color: 'var(--c-ink-3)', marginBottom: 10 }} />
          <strong style={{ display: 'block', color: 'var(--c-ink)', marginBottom: 6 }}>
            {title}
          </strong>
          {text}
        </div>
      </Card>
    )
  }
  return (
    <div style={{ padding: 22 }}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>
        {title}
      </p>
      {text ? (
        <p className="body" style={{ margin: 0, maxWidth: 460, color: 'var(--c-ink-2)' }}>
          {text}
        </p>
      ) : null}
    </div>
  )
}
