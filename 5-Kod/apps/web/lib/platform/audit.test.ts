import { describe, it, expect } from 'vitest'
import { classifyAuditActor, classifyAuditTone } from './audit'

// Pure classification for the Drift & logg actor filter + row tone. audit_log
// stores dotted action keys (tenant.suspend, booking.status.pending …); these map
// each to an actor bucket (Alla/Zivar/System/Kund) and a muted status tone.

describe('classifyAuditActor', () => {
  it('tenant.* actions are Zivar (platform operator)', () => {
    expect(classifyAuditActor('tenant.suspend', 'uid')).toBe('Zivar')
    expect(classifyAuditActor('tenant.create', null)).toBe('Zivar')
  })
  it('booking/customer actions are Kund when there is an actor, else System', () => {
    expect(classifyAuditActor('booking.cancelled', 'cust')).toBe('Kund')
    expect(classifyAuditActor('booking.status.pending', null)).toBe('System')
  })
  it('actor-less misc events are System', () => {
    expect(classifyAuditActor('webhook.received', null)).toBe('System')
  })
})

describe('classifyAuditTone', () => {
  it('destructive keys read danger/warning', () => {
    expect(classifyAuditTone('tenant.delete')).toBe('danger')
    expect(classifyAuditTone('tenant.suspend')).toBe('warning')
    expect(classifyAuditTone('booking.cancelled')).toBe('warning')
  })
  it('constructive keys read success', () => {
    expect(classifyAuditTone('tenant.create')).toBe('success')
    expect(classifyAuditTone('tenant.activate')).toBe('success')
    expect(classifyAuditTone('booking.status.completed')).toBe('success')
  })
  it('plain booking status is neutral; everything else info', () => {
    expect(classifyAuditTone('booking.status.pending')).toBe('neutral')
    expect(classifyAuditTone('tenant.branding')).toBe('info')
  })
})
