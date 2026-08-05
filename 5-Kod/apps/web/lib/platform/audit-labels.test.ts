import { describe, expect, it } from 'vitest'
import { platformAuditActionLabel } from './audit-labels'

describe('platform audit labels', () => {
  it('uses one vocabulary and preserves unknown keys', () => {
    expect(platformAuditActionLabel('tenant.invite')).toBe('Ägare inbjuden')
    expect(platformAuditActionLabel('booking.status.confirmed')).toBe('Bokning bekräftad')
    expect(platformAuditActionLabel('booking.created')).toBe('Bokningshändelse')
    expect(platformAuditActionLabel('future.event')).toBe('future.event')
  })
})
