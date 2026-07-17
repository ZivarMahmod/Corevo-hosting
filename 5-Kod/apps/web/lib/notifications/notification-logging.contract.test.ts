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

    // Utan credentials degraderar transporten till ett EXPLICIT skipped-resultat —
    // aldrig ett tyst "levererat".
    expect(sms).toContain("return { ok: false, skipped: true, error: 'transport_unavailable' }")
    // Sedan 46elks kopplades in (plan 006) får ok:true bara förekomma EN gång —
    // efter provider-svarets res.ok-vakt. Ett ok utan vakt vore ett falskt leveransbesked.
    // (Plan 014: ok-returen bär nu även providerId/costOre till outboxen.)
    expect(sms.match(/ok: true,/g)).toHaveLength(1)
    expect(sms).toContain('if (!res.ok) {')
    expect(sms.indexOf('if (!res.ok) {')).toBeLessThan(sms.indexOf('ok: true,'))
  })
})
