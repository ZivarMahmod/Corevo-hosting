import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from './Badge'

/** Loyalty tier → badge tone (playbook §4.6: Guld→gold, Silver→info, Ny→success,
 *  else neutral). Pure mapping so consumers don't re-derive it. */
export function tierTone(tier: string | null | undefined): BadgeTone {
  switch (tier) {
    case 'Guld':
      return 'gold'
    case 'Silver':
      return 'info'
    case 'Ny':
      return 'success'
    default:
      return 'neutral'
  }
}

/**
 * Customer recognition row (playbook §4.6 / Bokningar §3.2 drawer + Kunder detail
 * + Frisör card). The compact "who is this customer" header: a forest avatar with
 * the leading initial, the resolved name + an optional shield glyph for a hidden
 * display name, a tier badge, and a muted "X besök · sedan Y" meta line. Dumb +
 * presentational — the parent resolves the name (resolveCustomerName) and passes
 * the derived tier/visits/since, so this never touches the data layer.
 *
 * NOTE: this is the recognition *header* only — NOT the staff "cadence/drink"
 * strip (those fields are data-gated-absent per the truth report and belong to a
 * page, not this shared primitive).
 */
export function CustomerRecognition({
  name,
  tier,
  visits,
  since,
  protectedName = false,
  size = 'md',
  extra,
}: {
  /** Already-resolved display name (respects name_hidden). */
  name: string
  /** Loyalty tier label, e.g. "Guld" — omit to hide the badge. */
  tier?: string | null
  /** Completed-visit count (derived). Omit when unknown. */
  visits?: number | null
  /** "Kund sedan" label (e.g. a year or date) — already formatted. */
  since?: string | null
  /** Show the info shield glyph next to the name (customer hid their full name). */
  protectedName?: boolean
  size?: 'sm' | 'md'
  /** Optional trailing slot (e.g. a "Skyddat namn" badge) pushed to the right. */
  extra?: ReactNode
}) {
  const avatar = size === 'sm' ? 30 : 44
  const initial = (name?.trim()?.[0] ?? '·').toUpperCase()
  const metaParts: string[] = []
  if (tier) metaParts.push(tier)
  if (visits != null) metaParts.push(`${visits} besök`)
  if (since) metaParts.push(`kund sedan ${since}`)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          width: avatar,
          height: avatar,
          flex: 'none',
          borderRadius: 999,
          background: 'var(--c-forest)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          fontSize: size === 'sm' ? 12.5 : 17,
        }}
      >
        {initial}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            fontSize: size === 'sm' ? 14 : 15,
            color: 'var(--c-ink)',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          {protectedName && (
            <span
              aria-label="Skyddat namn"
              style={{ color: 'var(--c-info)', flex: 'none', display: 'grid', placeItems: 'center' }}
            >
              <ShieldGlyph />
            </span>
          )}
          {tier && (
            <span style={{ flex: 'none' }}>
              <Badge tone={tierTone(tier)} dot={false}>
                {tier}
              </Badge>
            </span>
          )}
        </div>
        {metaParts.length > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)', marginTop: 2 }}>
            {metaParts.join(' · ')}
          </div>
        )}
      </div>
      {extra && <span style={{ flex: 'none' }}>{extra}</span>}
    </div>
  )
}

/* tiny inline shield (12px) — avoids pulling the full Icon stroke weight at this
   inline size while staying on the same Lucide silhouette as Icon's "shield". */
function ShieldGlyph() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  )
}
