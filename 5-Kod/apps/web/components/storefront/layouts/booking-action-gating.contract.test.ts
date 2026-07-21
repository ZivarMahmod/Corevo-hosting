import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const actions = fs.readFileSync(path.join(WEB_ROOT, 'app', 'boka', 'actions.ts'), 'utf8')

describe('public booking actions enforce the module gate at the trust boundary', () => {
  it('blocks slot reads and booking writes unless booking is live', () => {
    expect(actions).toContain("import { bookingModuleAccess }")
    expect(actions).toContain('getTenantModuleStates(ctx.tenantId, ctx.slug)')
    expect(actions.match(/await publicBookingIsLive\(ctx\)/g)).toHaveLength(3)
    expect(actions).toContain('export async function startBookingVerification')
    expect(actions).toContain('export async function verifyAndCreateBooking')
  })
})
