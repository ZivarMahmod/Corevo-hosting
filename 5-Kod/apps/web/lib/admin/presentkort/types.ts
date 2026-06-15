// Admin-presentkort (gift card) types + pure helpers. PURE module: no 'server-only',
// no 'use server'. Safe to import from client components and server loaders/actions
// alike. Mirrors lib/admin/shop/types.ts — the only import is a type-only BadgeTone
// (type imports are erased at compile time, so this stays a zero-runtime-dep file).

import type { BadgeTone } from '@/components/portal/ui'

export type GiftCardStatus = 'active' | 'redeemed' | 'expired' | 'void'

export type GiftCardRow = {
  id: string
  code: string
  initialAmountCents: number
  balanceCents: number
  currency: string
  status: GiftCardStatus
  recipientName: string | null
  recipientEmail: string | null
  message: string | null
  expiresAt: string | null
  createdAt: string
}

/**
 * Format a minor-unit amount (e.g. 50000) as a Swedish-formatted string.
 * Same shape as formatCents in lib/admin/shop/types.ts (SEK → "kr" suffix;
 * otherwise ISO code suffix). Kept as a separate copy so this module stays pure.
 */
export function formatGiftAmount(cents: number, currency = 'SEK'): string {
  const major = (cents / 100).toLocaleString('sv-SE', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return currency === 'SEK' ? `${major} kr` : `${major} ${currency}`
}

/** Gift-card status → Badge tone (matches shop's status→tone convention). */
export function giftStatusTone(status: GiftCardStatus): BadgeTone {
  switch (status) {
    case 'active':
      return 'success'
    case 'redeemed':
      return 'neutral'
    case 'expired':
      return 'warning'
    case 'void':
      return 'danger'
    default:
      return 'neutral'
  }
}

/** Swedish display label for a gift-card status. */
export function giftStatusLabel(status: GiftCardStatus): string {
  switch (status) {
    case 'active':
      return 'Aktivt'
    case 'redeemed':
      return 'Inlöst'
    case 'expired':
      return 'Utgånget'
    case 'void':
      return 'Makulerat'
    default:
      return status
  }
}

/**
 * Kronor (a number from a form field) → integer öre. Defensive: rounds and floors
 * at 0 so a stray negative or float can't produce a fractional/negative öre value.
 * Mirrors the rounding in lib/admin/format.ts kronorToCents.
 */
export function kronorToCents(kr: number): number {
  if (!Number.isFinite(kr) || kr < 0) return 0
  return Math.round(kr * 100)
}
