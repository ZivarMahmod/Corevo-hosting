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

/**
 * Får kortet makuleras? Bara ETT aktivt kort kan spärras — ett redan inlöst,
 * utgånget eller makulerat kort är per definition inte en öppen pengaskuld, och
 * att "makulera" det igen skulle bara skriva över historiken.
 *
 * ENDA SANNINGEN: både VoidCell (UI, döljer knappen) och voidGiftCard (server,
 * nekar skrivningen) filtrerar genom den här — precis som offertTransitionAllowed.
 * UI-kontrollen är bekvämlighet; server-kontrollen är fencen (en server-action är
 * en publik HTTP-yta, en klient kan posta vad som helst).
 */
export function giftCardVoidable(status: GiftCardStatus): boolean {
  return status === 'active'
}

/**
 * Får kortet lösas in? ETT MAKULERAT KORT FÅR ALDRIG LÖSAS IN — det är hela
 * poängen med makulering: ett felutfärdat värdebevis är en pengaskuld, och
 * spärren måste gälla på inlösen-vägen, inte bara i listan.
 *
 * Reglerna, i ordning: status måste vara 'active' ('void' | 'redeemed' | 'expired'
 * är alla obrukbara), saldot måste vara > 0, och giltighetstiden får inte ha
 * passerat.
 *
 * ⚠️ INGEN INLÖSEN-VÄG FINNS ÄN (2026-07-12). gift_cards är inte anon-läsbar
 * (0036) och lib/storefront/presentkort/load-presentkort.ts gör medvetet INGEN
 * tabell-query — den publika ytan är ren promo; adminens Callout säger "inlösen
 * aktiveras när betalning slås på". Den här predikaten är därför KONTRAKTET som
 * inlösen-vägen MÅSTE gå igenom den dagen den byggs — lägg inte en egen
 * status-koll bredvid, anropa den här.
 */
export function giftCardRedeemable(
  card: Pick<GiftCardRow, 'status' | 'balanceCents' | 'expiresAt'>,
  now: Date = new Date(),
): boolean {
  if (card.status !== 'active') return false // 'void' fastnar här — makulerat = obrukbart
  if (!(card.balanceCents > 0)) return false
  if (card.expiresAt && new Date(card.expiresAt).getTime() < now.getTime()) return false
  return true
}
