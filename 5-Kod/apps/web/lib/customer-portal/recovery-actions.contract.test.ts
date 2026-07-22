import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const recoveryActions = readFileSync(fileURLToPath(new URL(
  '../../app/(customer-portal)/(open)/aterhamta/[tenantSlug]/actions.ts', import.meta.url,
)), 'utf8')
const verifyActions = readFileSync(fileURLToPath(new URL(
  '../../app/(customer-portal)/(open)/verifiera/[tenantSlug]/actions.ts', import.meta.url,
)), 'utf8')
const logoutActions = readFileSync(fileURLToPath(new URL(
  '../../app/(customer-portal)/mina/actions.ts', import.meta.url,
)), 'utf8')

describe('portal recovery route actions', () => {
  it('keeps the recovery start/resend boundary server-only, no-store and IP-limited', () => {
    expect(recoveryActions).toMatch(/^'use server'/)
    expect(recoveryActions).toContain('noStore()')
    expect(recoveryActions).toContain('getClientIp()')
    expect(recoveryActions).toContain('startPortalRecovery')
    expect(recoveryActions).toContain('resendPortalRecovery')
    expect(recoveryActions).not.toMatch(/localStorage|sessionStorage|searchParams/)
  })

  it('keeps verification and credential state behind server actions', () => {
    expect(verifyActions).toMatch(/^'use server'/)
    expect(verifyActions).toContain('noStore()')
    expect(verifyActions).toContain('getClientIp()')
    expect(verifyActions).toContain('verifyPortalRecovery')
    expect(verifyActions).toContain('getPortalRecoveryState')
    expect(verifyActions).not.toMatch(/localStorage|sessionStorage|searchParams/)
  })

  it('keeps current-session logout server-only and no-store', () => {
    expect(logoutActions).toMatch(/^'use server'/)
    expect(logoutActions).toContain('noStore()')
    expect(logoutActions).toContain('logoutCurrentPortalSession')
    expect(logoutActions).not.toMatch(/localStorage|sessionStorage|searchParams/)
  })
})
