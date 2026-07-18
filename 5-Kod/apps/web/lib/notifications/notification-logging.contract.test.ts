import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function sourceAt(relativePath: string): string {
  return readFileSync(path.join(WEB_ROOT, relativePath), 'utf8')
}

describe('notification log privacy', () => {
  it('never writes an email address or phone number into notification logs', () => {
    const booking = sourceAt('lib/notifications/booking.ts')
    const sms = sourceAt('lib/notifications/sms.ts')

    expect(booking).not.toMatch(/logger\.(?:info|warn|error)\([^\n]+\{\s*kind,\s*to(?:[,\s}])/)
    expect(sms).not.toMatch(/logger\.(?:info|warn|error)\([^\n]+\{\s*to(?:[,\s}])/)
  })

  it('keeps skipped SMS explicitly unavailable instead of reporting delivery', () => {
    const sms = sourceAt('lib/notifications/sms.ts')

    // Den fysiska off-grinden ligger före fetch och båda providergrenar kräver
    // validerade svar. Dry-run heter simulated, aldrig sent/delivered.
    expect(sms).toContain("if (mode === 'off')")
    expect(sms.indexOf("if (mode === 'off')")).toBeLessThan(sms.indexOf('await fetch('))
    expect(sms).toContain("mode: 'dry_run' | 'live'")
    expect(sms).toContain('simulated: true')
    expect(sms).toContain("return { ok: false, skipped: true, mode, error: 'transport_unavailable' }")
    expect(sms).not.toContain('err.message')
  })

  it('has no legacy mutation path that can promote simulated SMS to delivered', () => {
    const booking = sourceAt('lib/notifications/booking.ts')
    const events = sourceAt('lib/notifications/booking-events.ts')
    const reminders = sourceAt('lib/notifications/reminders.ts')
    const cancellation = sourceAt('app/avboka/actions.ts')
    const sms = sourceAt('lib/notifications/sms.ts')

    expect(events).toContain("rpc('route_booking_notification'")
    expect(reminders).toContain('queueBookingEvent')
    expect(cancellation).toContain('queueBookingEvent')
    expect(booking).not.toMatch(/\bsendSms\s*\(/)
    expect(reminders).not.toMatch(/\bsendSms\s*\(/)
    expect(cancellation).not.toMatch(/\bsendSms\s*\(/)
    expect(booking).not.toContain('allowProviderDryRun')
    expect(reminders).not.toContain('allowProviderDryRun')
    expect(cancellation).not.toContain('allowProviderDryRun')
    expect(sms).toContain('allowProviderDryRun: true')
  })
})
