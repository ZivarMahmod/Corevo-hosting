import { describe, it, expect } from 'vitest'
import { classifyAuditActor, classifyAuditTone, logPlatformAction } from './audit'

// Pure classification for the Drift & logg actor filter + row tone. audit_log
// stores dotted action keys (tenant.suspend, booking.status.pending …); these map
// each to an actor bucket (Alla/Zivar/System/Kund) and a muted status tone.

describe('classifyAuditActor', () => {
  it('tenant.* actions are Zivar (platform operator)', () => {
    expect(classifyAuditActor('tenant.suspend', 'uid')).toBe('Zivar')
    expect(classifyAuditActor('tenant.create', null)).toBe('Zivar')
  })
  it('attributes customer site-editor revisions to the customer actor', () => {
    expect(classifyAuditActor('tenant.site_draft_save', 'owner')).toBe('Kund')
    expect(classifyAuditActor('tenant.site_draft_publish', 'owner')).toBe('Kund')
    expect(classifyAuditActor('tenant.site_revision_restore', null)).toBe('System')
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

describe('logPlatformAction', () => {
  const args = {
    action: 'tenant.password_reset' as const,
    tenantId: '11111111-1111-4111-8111-111111111111',
    actorId: '22222222-2222-4222-8222-222222222222',
  }

  it('returnerar verifierad success endast när insert saknar DB-fel', async () => {
    const insert = async () => ({ error: null })
    const client = { from: () => ({ insert }) }

    await expect(logPlatformAction(client as never, args)).resolves.toEqual({ ok: true })
  })

  it('gör DB-fel observerbart utan att kasta efter den redan utförda huvudhandlingen', async () => {
    const insert = async () => ({ error: { message: 'audit unavailable' } })
    const client = { from: () => ({ insert }) }

    await expect(logPlatformAction(client as never, args)).resolves.toEqual({ ok: false })
  })

  it('gör kast från auditklienten observerbart utan att kasta vidare', async () => {
    const insert = async () => { throw new Error('network down') }
    const client = { from: () => ({ insert }) }

    await expect(logPlatformAction(client as never, args)).resolves.toEqual({ ok: false })
  })
})
