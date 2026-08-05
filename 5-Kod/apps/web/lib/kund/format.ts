// Small display helpers for the customer portal. Times are always rendered in
// the location's timezone (the booking's location), never the browser's.

import { formatTenantMoney } from '@/lib/tenant-region'

export function formatSlot(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

export function formatPrice(cents: number | null): string {
  return cents == null ? '' : formatTenantMoney(cents)
}
