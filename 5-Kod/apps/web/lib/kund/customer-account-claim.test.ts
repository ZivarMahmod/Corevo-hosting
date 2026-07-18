import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  customerClaimPath,
  createCustomerClaimToken,
  hashCustomerClaimToken,
  isSafeCustomerClaimOrigin,
  isCustomerClaimPath,
} from './customer-claim'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')
const migration = fs.readFileSync(
  path.join(CODE_ROOT, 'supabase', 'migrations', '0096_customer_account_claim.sql'),
  'utf8',
)
const route = fs.readFileSync(
  path.join(WEB_ROOT, 'app', '(kund)', '(claim)', 'konto', 'koppla', '[token]', 'page.tsx'),
  'utf8',
)
const portalLayout = fs.readFileSync(
  path.join(WEB_ROOT, 'app', '(kund)', 'konto', 'layout.tsx'),
  'utf8',
)
const signupAction = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'kund', 'actions.ts'), 'utf8')
const claimServer = fs.readFileSync(
  path.join(WEB_ROOT, 'lib', 'kund', 'customer-claim-server.ts'),
  'utf8',
)
const runtimeSql = fs.readFileSync(
  path.join(CODE_ROOT, 'supabase', 'tests', 'customer_account_claim_0096_test.sql'),
  'utf8',
)
const registerPage = fs.readFileSync(
  path.join(WEB_ROOT, 'app', '(kund)', 'registrera', 'page.tsx'),
  'utf8',
)
const loginForm = fs.readFileSync(
  path.join(WEB_ROOT, 'app', '(auth)', 'login', 'LoginForm.tsx'),
  'utf8',
)

describe('customer account claim', () => {
  it('hashes the bearer token and only emits an internal claim path', async () => {
    const token = 'a'.repeat(43)
    await expect(hashCustomerClaimToken(token)).resolves.toMatch(/^[a-f0-9]{64}$/)
    expect(customerClaimPath(token)).toBe(`/konto/koppla/${token}`)
    expect(isCustomerClaimPath(`/konto/koppla/${token}`)).toBe(true)
    expect(isCustomerClaimPath('//evil.example/konto/koppla/token')).toBe(false)
    expect(isCustomerClaimPath('/konto/koppla/short')).toBe(false)
  })

  it('creates 256-bit URL-safe bearer tokens without collisions in the sample', () => {
    const tokens = Array.from({ length: 128 }, () => createCustomerClaimToken())
    expect(new Set(tokens)).toHaveLength(tokens.length)
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('requires HTTPS and the default port for non-local claim origins', () => {
    const allowedHosts = new Set(['freshcut.corevo.se'])
    expect(isSafeCustomerClaimOrigin('https://freshcut.corevo.se', allowedHosts, false)).toBe(true)
    expect(isSafeCustomerClaimOrigin('http://freshcut.corevo.se', allowedHosts, false)).toBe(false)
    expect(isSafeCustomerClaimOrigin('https://freshcut.corevo.se:8443', allowedHosts, false)).toBe(false)
    expect(isSafeCustomerClaimOrigin('https://user:pass@freshcut.corevo.se', allowedHosts, false)).toBe(false)
    expect(isSafeCustomerClaimOrigin('https://evil.example', allowedHosts, false)).toBe(false)
    expect(isSafeCustomerClaimOrigin('http://freshcut.localhost:3000', new Set(), true)).toBe(true)
    expect(isSafeCustomerClaimOrigin('http://freshcut.localhost:3000', new Set(), false)).toBe(false)
  })

  it('keeps token records private, hashed, expiring and single-use', () => {
    expect(migration).toContain('create table private.customer_account_claims')
    expect(migration).toContain('token_hash text')
    expect(migration).not.toMatch(/claim_token\s+(?:uuid|text)/i)
    expect(migration).toContain('expires_at timestamptz not null')
    expect(migration).toContain('used_at timestamptz')
    expect(migration).toContain('purpose text not null')
    expect(migration).toContain('for update')
    expect(migration).toContain('used_at is null')
    expect(migration).toContain('token_hash = null')
    expect(migration).toContain("set search_path = ''")
  })

  it('fences the authenticated claim by auth user and tenant before merging', () => {
    expect(migration).toContain('create or replace function public.claim_customer_account')
    expect(migration).toContain('(select auth.uid())')
    expect(migration).not.toContain('v_jwt_tenant uuid := (select private.tenant_id())')
    expect(migration).toContain('u.id = v_uid')
    expect(migration).toContain('u.tenant_id = p_tenant')
    expect(migration).toContain('customer_claim_tenant_mismatch')
    expect(migration).toContain('customer_claim_account_tenant_mismatch')
    expect(migration).toContain('r.level = 2')
    expect(migration).toContain("u.status in ('active', 'pending_claim')")
    expect(migration).not.toContain("u.status in ('active', 'inactive')")
    expect(migration).toContain('for update of u')
    expect(migration).toContain('customer_claim_already_bound')
    expect(migration).toContain('update public.bookings')
    expect(migration).toContain('update public.loyalty_ledger')
    expect(migration).toContain('insert into public.customer_favorites')
    expect(migration).toContain('insert into public.customer_notes')
    expect(migration).toContain('insert into public.customer_notification_prefs')
    expect(migration).toContain('update public.push_subscriptions')
    expect(migration).toContain('update public.notifications_outbox')
    expect(migration).toContain('update public.shop_orders')
    expect(migration).toContain('update public.offert_requests')
    expect(migration).toContain('from public.loyalty_members')
    expect(migration).toContain('customer_claim_loyalty_membership_conflict')
    expect(migration).toContain("status = 'anonymized'")
    expect(migration).not.toMatch(/phone\s*=\s*.*auth_user_id/i)
  })

  it('activates only the locked provisional profile in the claim transaction', () => {
    const claimStart = migration.indexOf('create or replace function public.claim_customer_account')
    const claimEnd = migration.indexOf(
      'create or replace function public.scrub_customer_account_claims',
      claimStart,
    )
    const claimFunction = migration.slice(claimStart, claimEnd)
    const consume = claimFunction.indexOf('used_by = v_uid')
    const bind = claimFunction.indexOf('set auth_user_id = v_uid')
    const activate = claimFunction.lastIndexOf("set status = 'active'")
    const success = claimFunction.indexOf("status := 'claimed'")

    expect(consume).toBeGreaterThan(-1)
    expect(bind).toBeGreaterThan(-1)
    expect(activate).toBeGreaterThan(consume)
    expect(activate).toBeGreaterThan(bind)
    expect(success).toBeGreaterThan(activate)
    expect(claimFunction).toContain("v_profile.status = 'pending_claim'")
    expect(claimFunction).toContain("and u.status = 'pending_claim'")
    expect(claimFunction).toContain('customer_claim_profile_activation_race')
    expect(migration).toContain('create or replace function public.reconcile_customer_account_claim')
    expect(migration).toMatch(
      /grant execute on function public\.reconcile_customer_account_claim\([\s\S]*?to service_role;/,
    )
    expect(migration).not.toMatch(
      /grant execute on function public\.reconcile_customer_account_claim\([^;]*to authenticated;/,
    )

    expect(runtimeSql).toContain("'pending_claim'")
    expect(runtimeSql).toContain('provisional_role_leaked_portal_access')
    expect(runtimeSql).toContain('provisional_cross_tenant_claim_succeeded')
    expect(runtimeSql).toContain('provisional_activated_without_claim')
    expect(runtimeSql).toContain('claim_success_not_activated_atomically')
    expect(runtimeSql).toContain('merged_claim_not_reconciled')
    expect(runtimeSql).toContain('wrong_user_claim_reconciled')
  })

  it('exposes only narrow RPC grants and no Data API token table', () => {
    expect(migration).toMatch(
      /revoke all on function public\.claim_customer_account\([\s\S]*?from public, anon, authenticated, service_role;/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.claim_customer_account\([\s\S]*?to authenticated;/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.create_customer_account_claim\([\s\S]*?to service_role;/,
    )
    expect(migration).not.toMatch(/grant .*private\.customer_account_claims/i)
  })

  it('claims on the tenant route and keeps registration return paths internal', () => {
    expect(route).toContain('currentKundTenant()')
    expect(route).toContain('requireUser(')
    expect(route).not.toContain("requirePortal('kund')")
    expect(route).toContain('outside the guarded /konto layout')
    expect(portalLayout).toContain("requirePortal('kund')")
    expect(route).toContain('consumeCustomerClaim(')
    expect(route).toContain('hashCustomerClaimToken(token)')
    expect(signupAction).toContain('safeInternalRedirectPath')
    expect(signupAction).toContain('isCustomerClaimPath(next)')
    expect(claimServer).toContain("rpc('inspect_customer_account_claim'")
    expect(claimServer).toContain("from('tenant_domains')")
    expect(claimServer).toContain('isSafeCustomerClaimOrigin(')
    expect(signupAction).toContain('consumeCustomerClaim(')
    expect(signupAction).toContain("status: 'pending_claim'")
    expect(signupAction).toContain("redirect('/konto?kopplad=1')")
    expect(registerPage).toContain('if (!isCustomerClaimPath(next)) notFound()')
    expect(loginForm).toContain('isCustomerClaimPath(next)')
    expect(loginForm).toContain('/registrera?next=')
  })

  it('adds a GDPR scrub contract for source and merged claim references', () => {
    expect(migration).toContain('create or replace function public.scrub_customer_account_claims')
    expect(migration).toContain('customer_id = any')
    expect(migration).toContain('claimed_customer_id = any')
    expect(migration).toContain('used_by = null')
    expect(migration).toContain('scrubbed_at = now()')
  })
})
