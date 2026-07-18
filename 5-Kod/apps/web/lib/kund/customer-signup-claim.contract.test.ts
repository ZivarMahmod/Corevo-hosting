import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const actions = fs.readFileSync(path.join(ROOT, 'actions.ts'), 'utf8')

function signupBody(): string {
  const start = actions.indexOf('export async function signUpCustomer')
  const end = actions.indexOf('// ── Profile', start)
  return actions.slice(start, end)
}

describe('claim-gated signup compensation', () => {
  it('creates a non-authorized provisional profile before any claim attempt', () => {
    const body = signupBody()
    const provisional = body.indexOf("status: 'pending_claim'")
    const signIn = body.indexOf('signInWithPassword')
    const claim = body.indexOf('consumeOrReconcileCustomerClaim({')

    expect(provisional).toBeGreaterThan(-1)
    expect(signIn).toBeGreaterThan(provisional)
    expect(claim).toBeGreaterThan(signIn)
    expect(body).not.toContain("status: 'active'")
  })

  it('consumes the claim after session creation and before the success redirect', () => {
    const body = signupBody()
    const signIn = body.indexOf('signInWithPassword')
    const claim = body.indexOf('consumeOrReconcileCustomerClaim({')
    const success = body.lastIndexOf("redirect('/konto?kopplad=1')")
    expect(signIn).toBeGreaterThan(-1)
    expect(claim).toBeGreaterThan(signIn)
    expect(success).toBeGreaterThan(claim)
  })

  it('reconciles an ambiguous committed claim before compensating the loser', () => {
    expect(actions).toContain('reconcileCustomerClaim(')
    expect(actions).toContain('consumeOrReconcileCustomerClaim(')
    expect(actions).toContain('if (reconciled.ok && reconciled.claimed)')
    expect(actions).toContain('if (!reconciled.ok)')
  })

  it('deletes auth only after conditionally removing the still-provisional profile', () => {
    expect(actions).toContain('async function cleanupProvisionalClaimAccount')
    expect(actions).toContain(".eq('status', 'pending_claim')")
    expect(actions).toContain(".select('id')")
    expect(actions).toContain('if (!removedProfile?.id) return')
    const guardedReturn = actions.indexOf('if (!removedProfile?.id) return')
    const authDelete = actions.indexOf('admin.auth.admin.deleteUser(userId)', guardedReturn)
    expect(authDelete).toBeGreaterThan(guardedReturn)
  })

  it('keeps a failed cleanup non-authorized because activation exists only in the claim RPC', () => {
    const body = signupBody()
    expect(body).toContain("status: 'pending_claim'")
    expect(body).not.toContain("status: 'active'")
    expect(actions).toContain('cleanupProvisionalClaimAccount(')
  })

  it('recovers an existing same-tenant auth shell by authenticating before reuse', () => {
    const body = signupBody()
    const exists = body.indexOf('createErr')
    const recover = body.indexOf('recoverExistingClaimAccount(', exists)
    expect(recover).toBeGreaterThan(exists)
    expect(actions).toContain('async function recoverExistingClaimAccount')
    expect(actions).toContain('args.supabase.auth.signInWithPassword({')
    expect(actions).toContain("profile.status === 'pending_claim'")
    expect(actions).toContain("profile.status === 'active'")
    expect(actions).toContain('authTenantId !== args.tenantId')
    expect(actions).toContain('consumeOrReconcileCustomerClaim(')
  })
})
