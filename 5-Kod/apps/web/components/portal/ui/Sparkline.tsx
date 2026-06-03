import type { CSSProperties } from 'react'

/**
 * Pure-SVG sparkline — EXACT port of the design-system handoff (Shell.jsx →
 * Sparkline): a single gold polyline normalised into a w×h box. Server-safe (no
 * hooks, no client state), so it renders inside server components like the platform
 * Översikt KPI card.
 *
 * Honest by construction: the line is drawn from whatever real series it's handed.
 * When every value is equal (e.g. a sparse DB with no booking history) max-min
 * collapses to 0 → the `|| 1` guard yields a flat line, never a fabricated curve.
 */
export function Sparkline({
  data,
  w = 220,
  h = 48,
  color = 'var(--c-gold)',
  style,
}: {
  data: number[]
  w?: number
  h?: number
  color?: string
  style?: CSSProperties
}) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 6) - 3}`)
    .join(' ')
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: 'block', maxWidth: '100%', ...style }}
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
