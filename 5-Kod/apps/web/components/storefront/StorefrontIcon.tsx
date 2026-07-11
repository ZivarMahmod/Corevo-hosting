import type { CSSProperties, ReactElement } from 'react'

/**
 * Tiny inline icon set for the storefront layouts (Lucide-derived, MIT).
 * Thin stroke, currentColor — so each icon takes the theme's text/accent colour.
 * Kept local to the storefront so we don't reach into the back-office portal Icon.
 */
const PATHS: Record<string, ReactElement> = {
  scissors: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.5 15.5M14.5 12.5 20 18M8.5 8.5 12 12" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  bag: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
}

export function StorefrontIcon({
  name,
  size = 20,
  stroke = 1.75,
  style,
  className,
}: {
  name: keyof typeof PATHS | string
  size?: number
  stroke?: number
  style?: CSSProperties
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flex: 'none', ...style }}
      aria-hidden="true"
    >
      {PATHS[name] ?? null}
    </svg>
  )
}
