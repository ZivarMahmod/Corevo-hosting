import { describe, it, expect, vi, afterEach } from 'vitest'
import { reportActionError } from './observe'

// goal-44 Spår A — PROVE the observability sink, don't assume it. The Workers log
// stream IS console.* (lib/observability.log), so spying console.error proves a
// provoked server-action error LANDS in the sink, with the PII guards holding.

afterEach(() => vi.restoreAllMocks())

describe('reportActionError — observability sink (goal-44 Spår A)', () => {
  it('routes a provoked action error to the sink (Workers stream = console.error)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // a supabase-style error object (NOT an Error instance) + safe context
    await reportActionError(
      'createTenant.settings_insert',
      { code: '23505', message: 'duplicate key value' },
      { tenantId: 't-1' },
    )
    expect(spy).toHaveBeenCalledTimes(1)
    const line = JSON.parse(spy.mock.calls[0][0] as string)
    expect(line.level).toBe('error')
    expect(line.action).toBe('createTenant.settings_insert')
    expect(line.code).toBe('23505') // the Postgres code IS logged (useful, non-PII)
    expect(line.tenantId).toBe('t-1')
  })

  it('logs ONLY the supabase code, never the raw message/detail (which can echo a value)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await reportActionError(
      'x',
      { code: '23505', message: 'Key (email)=(a@b.se) already exists', details: 'a@b.se' },
      { tenantId: 't' },
    )
    const raw = spy.mock.calls[0][0] as string
    expect(raw).not.toContain('a@b.se') // message/detail never reach the sink
    expect(raw).toContain('23505')
  })

  it('redacts secret-looking field keys (PII/secret backstop)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // a caller mistake: PII/secret slipped into fields — redact() must mask it.
    await reportActionError('x', new Error('boom'), {
      token: 'sekret-abc',
      password: 'hunter2',
      authorization: 'Bearer xyz',
      tenantId: 't',
    })
    const raw = spy.mock.calls[0][0] as string
    expect(raw).not.toContain('sekret-abc')
    expect(raw).not.toContain('hunter2')
    expect(raw).not.toContain('Bearer xyz')
    expect(raw).toContain('[redacted]')
    expect(raw).toContain('"tenantId":"t"') // non-secret field survives
  })

  it('NEVER throws into the action, even when the sink itself would (best-effort)', async () => {
    // a circular field makes JSON.stringify throw inside the (unguarded) log() call —
    // reportActionError's own try/catch must swallow it so telemetry never breaks the
    // path it observes (the goal's hard anti-pattern).
    const circular: Record<string, unknown> = {}
    circular.self = circular
    await expect(reportActionError('x', new Error('e'), circular)).resolves.toBeUndefined()
  })
})
