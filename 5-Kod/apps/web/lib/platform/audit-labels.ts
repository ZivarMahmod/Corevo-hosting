import { bookingStatusLabel } from '@/lib/booking/confirmation-status'

export const PLATFORM_AUDIT_TONE_COLORS = {
  info: 'var(--c-info)',
  success: 'var(--c-success)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-danger)',
  neutral: 'var(--c-ink-3)',
} as const

const LABELS: Record<string, string> = {
  'tenant.create': 'Kund skapad',
  'tenant.suspend': 'Kund pausad',
  'tenant.activate': 'Kund aktiverad',
  'tenant.delete': 'Kund borttagen',
  'tenant.branding': 'Varumärke uppdaterat',
  'tenant.billing': 'Prismodell ändrad',
  'tenant.invite': 'Ägare inbjuden',
  'tenant.update': 'Kunddata uppdaterad',
  'tenant.password_reset': 'Lösenordsreset skapad',
  'tenant.staff_create': 'Personal tillagd',
  'platform.help_mode_open': 'Hjälp-läge öppnat',
}

export function platformAuditActionLabel(action: string): string {
  if (LABELS[action]) return LABELS[action]
  if (action.startsWith('booking.status.')) {
    return `Bokning ${bookingStatusLabel(action.slice('booking.status.'.length)).toLowerCase()}`
  }
  return action.startsWith('booking.') ? 'Bokningshändelse' : action
}
