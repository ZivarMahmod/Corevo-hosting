import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const wizard = readFileSync(new URL('./BookingWizard.tsx', import.meta.url), 'utf8')
const bookingPage = readFileSync(
  new URL('../../app/boka/page.tsx', import.meta.url),
  'utf8',
)
const bookingActions = readFileSync(
  new URL('../../app/boka/actions.ts', import.meta.url),
  'utf8',
)

describe('Goal 83 booking regional contract', () => {
  it('threads tenant country, locale, currency and fallback timezone through booking', () => {
    expect(bookingPage).toContain('countryCode={settings.countryCode}')
    expect(bookingPage).toContain('locale={settings.locale}')
    expect(bookingPage).toContain('currency={settings.currency}')
    expect(bookingPage).toContain('defaultTimeZone={settings.defaultTimeZone}')
    expect(wizard).toContain('formatTenantMoney')
    expect(wizard).toContain('normalizeBookingContact(contactMode, selectedContact(), countryCode)')
    expect(bookingActions).toContain('normalizeBookingContact(channel, input.contact, ctx.countryCode)')
    expect(bookingActions).toContain('ctx.currency.toLowerCase()')
  })
})
