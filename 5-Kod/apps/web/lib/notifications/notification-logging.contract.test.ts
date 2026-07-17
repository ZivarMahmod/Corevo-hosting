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

    expect(sms).toContain("return { ok: false, skipped: true, error: 'transport_unavailable' }")
    expect(sms).not.toContain('return { ok: true }')
  })
})
