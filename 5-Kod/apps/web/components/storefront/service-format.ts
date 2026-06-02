import type { Service } from '@/lib/tenant-data'

const kr = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})

/** "695 kr" from a service's price_cents. */
export function formatPrice(s: Service): string {
  return kr.format(s.price_cents / 100)
}

/** "60 min" from a service's duration. */
export function formatDuration(s: Service): string {
  return `${s.duration_min} min`
}

/** Description, with an honest fallback when the salon left it empty. */
export function serviceDesc(s: Service): string {
  return s.description || `${s.duration_min} min behandling`
}

/** Two-digit editorial index ("01", "02", …) for the numbered rows. */
export function serviceNum(i: number): string {
  return String(i + 1).padStart(2, '0')
}
