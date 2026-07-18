import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const web = (path: string) => readFileSync(resolve(import.meta.dirname, '../../', path), 'utf8')

const mutationFiles = [
  'app/boka/actions.ts',
  'app/avboka/actions.ts',
  'lib/kund/actions.ts',
  'lib/admin/actions.ts',
  'lib/admin/calendar-actions.ts',
  'lib/personal/actions.ts',
] as const

describe('booking notification event coverage', () => {
  it('routes every booking mutation surface through the same durable producer', () => {
    for (const file of mutationFiles) {
      const source = web(file)
      expect(source, file).toContain('queueBookingEvent')
      expect(source, file).not.toMatch(/\bsendBooking(?:Confirmation|Cancellation|Rebook|Reminder)\s*\(/)
      expect(source, file).not.toMatch(/\bsendSms\s*\(/)
      expect(source, file).not.toMatch(/\bsendEmail\s*\(/)
    }
  })

  it('reminders enqueue one event and never call a provider directly', () => {
    const reminders = web('lib/notifications/reminders.ts')
    expect(reminders).toContain("type: 'booking_reminder'")
    expect(reminders).toContain('queueBookingEvent')
    expect(reminders).not.toMatch(/\bsendSms\s*\(/)
    expect(reminders).not.toMatch(/\bsendBookingReminder\s*\(/)
  })

  it('keeps the notification cron physically unwired until a full adapter is explicit', () => {
    const route = web('app/api/cron/notifications/route.ts')
    expect(route).toContain('dispatchNotificationOutbox()')
    expect(route).not.toMatch(/deliver\s*:/)
  })

  it('does not leave legacy direct booking senders available for future mutations', () => {
    const legacy = web('lib/notifications/booking.ts')
    expect(legacy).not.toMatch(/export async function sendBooking(?:Confirmation|Cancellation|Reminder|Rebook)/)
    expect(legacy).not.toMatch(/\bsendSms\s*\(/)
    expect(legacy).not.toMatch(/\bsendPushToCustomer\s*\(/)
  })
})
