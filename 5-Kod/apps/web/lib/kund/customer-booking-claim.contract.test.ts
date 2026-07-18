import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const bookings = fs.readFileSync(path.join(ROOT, 'bookings.ts'), 'utf8')
const actions = fs.readFileSync(path.join(ROOT, 'actions.ts'), 'utf8')

describe('claimed customer booking ownership', () => {
  it('reads and mutates the claimed durable customer band as well as the legacy profile band', () => {
    expect(bookings).toContain('getCustomerId(userId, tenantId)')
    expect(bookings).toContain('customer_id.eq.${customerId}')
    expect(bookings).toContain('customer_profile_id.eq.${userId}')
    expect(actions).toContain('user.tenantId')
    expect(actions).toContain('customer_id')
  })
})
