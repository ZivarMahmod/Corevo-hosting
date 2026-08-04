// Admin-presentkort (gift card) types + pure helpers. PURE module: no 'server-only',
// no 'use server'. Safe to import from client components and server loaders/actions
// alike. Mirrors lib/admin/shop/types.ts and has no UI dependency.

export type GiftCardStatus = 'active' | 'redeemed' | 'expired' | 'void'

export type GiftCardRow = {
  id: string
  maskedCode: string
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

export type GiftCardEntryRow = {
  id: string
  giftCardId: string
  amountCents: number
  balanceAfterCents: number
  currency: string
  entryType: string
  reason: string | null
  createdAt: string
}

export function giftEntryLabel(entryType: string): string {
  switch (entryType) {
    case 'opening':
      return 'Ingående saldo'
    case 'issue':
      return 'Utfärdat'
    case 'redeem':
      return 'Inlöst'
    case 'restore':
      return 'Återställt'
    case 'void':
      return 'Makulerat'
    case 'adjustment':
      return 'Justerat'
    default:
      return entryType
  }
}

/** Gift-card status → Badge tone (matches shop's status→tone convention). */
export function giftStatusTone(status: GiftCardStatus) {
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
