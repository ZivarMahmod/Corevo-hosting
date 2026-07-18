import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { createServiceClient } from '@/lib/platform/service'
import {
  createCustomerClaimToken,
  customerClaimPath,
  hashCustomerClaimToken,
  isSafeCustomerClaimOrigin,
} from './customer-claim'

const PURPOSE = 'customer_account'

export type CreateCustomerClaimLinkResult =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; reason: 'unavailable' | 'invalid_origin' | 'error' }

export type ConsumeCustomerClaimResult =
  | { ok: true; customerId: string; merged: boolean }
  | { ok: false; reason: 'invalid' | 'wrong_tenant' | 'ambiguous' }

export type ReconcileCustomerClaimResult =
  | { ok: true; claimed: boolean }
  | { ok: false }

/** Consume one already-hashed claim with the caller's authenticated client. */
export async function consumeCustomerClaim(args: {
  client: SupabaseClient<Database>
  tenantId: string
  tokenHash: string
}): Promise<ConsumeCustomerClaimResult> {
  try {
    const { data, error } = await args.client.rpc('claim_customer_account', {
      p_tenant: args.tenantId,
      p_token_hash: args.tokenHash,
      p_purpose: PURPOSE,
    })
    if (!error && data?.[0]?.customer_id) {
      return {
        ok: true,
        customerId: data[0].customer_id,
        merged: data[0].merged,
      }
    }

    const wrongTenant = /tenant_mismatch|account_tenant_mismatch/.test(error?.message ?? '')
    return { ok: false, reason: wrongTenant ? 'wrong_tenant' : 'invalid' }
  } catch {
    return { ok: false, reason: 'ambiguous' }
  }
}

/**
 * Resolve an ambiguous RPC response without guessing from an already-existing
 * customer card. This service-only probe binds the exact digest to `used_by`
 * and to the active customer/profile produced by the same DB transaction.
 */
export async function reconcileCustomerClaim(args: {
  tenantId: string
  tokenHash: string
  authUserId: string
}): Promise<ReconcileCustomerClaimResult> {
  const admin = createServiceClient()
  if (!admin) return { ok: false }
  try {
    const { data, error } = await admin.rpc('reconcile_customer_account_claim', {
      p_tenant: args.tenantId,
      p_token_hash: args.tokenHash,
      p_auth_user: args.authUserId,
      p_purpose: PURPOSE,
    })
    if (error) return { ok: false }
    return { ok: true, claimed: data === true }
  } catch {
    return { ok: false }
  }
}

/**
 * Creates a high-entropy bearer link while persisting only its SHA-256 digest.
 * This is intentionally not wired to a transport here; U4 owns notification
 * production. Callers must pass the already-resolved tenant storefront origin.
 */
export async function createCustomerClaimLink(args: {
  tenantId: string
  customerId: string
  origin: string
  ttlHours?: number
}): Promise<CreateCustomerClaimLinkResult> {
  const { tenantId, customerId } = args
  const ttlHours = Math.min(Math.max(args.ttlHours ?? 24, 1), 168)
  const admin = createServiceClient()
  if (!admin) return { ok: false, reason: 'unavailable' }

  const [{ data: tenant }, { data: domains }] = await Promise.all([
    admin.from('tenants').select('slug').eq('id', tenantId).eq('status', 'active').maybeSingle(),
    admin
      .from('tenant_domains')
      .select('domain')
      .eq('tenant_id', tenantId)
      .eq('verified', true),
  ])
  if (!tenant?.slug) return { ok: false, reason: 'error' }
  const suffix = process.env.NEXT_PUBLIC_TENANT_HOST_SUFFIX ?? 'boka.corevo.se'
  const allowedHosts = new Set([
    `${tenant.slug}.corevo.se`,
    `${tenant.slug}.${suffix}`,
    ...(domains ?? []).map((row) => row.domain.toLowerCase()),
  ])
  if (
    !isSafeCustomerClaimOrigin(
      args.origin,
      allowedHosts,
      process.env.NODE_ENV !== 'production',
    )
  ) {
    return { ok: false, reason: 'invalid_origin' }
  }
  const origin = new URL(args.origin)

  const token = createCustomerClaimToken()
  const tokenHash = await hashCustomerClaimToken(token)
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
  const { error } = await admin.rpc('create_customer_account_claim', {
    p_tenant: tenantId,
    p_customer: customerId,
    p_token_hash: tokenHash,
    p_purpose: PURPOSE,
    p_expires_at: expiresAt,
  })
  if (error) return { ok: false, reason: 'error' }

  origin.pathname = customerClaimPath(token)
  origin.search = ''
  origin.hash = ''
  return { ok: true, url: origin.toString(), expiresAt }
}

export async function inspectCustomerClaim(args: {
  tenantId: string
  token: string
}): Promise<boolean> {
  const admin = createServiceClient()
  if (!admin) return false
  try {
    const tokenHash = await hashCustomerClaimToken(args.token)
    const { data, error } = await admin.rpc('inspect_customer_account_claim', {
      p_tenant: args.tenantId,
      p_token_hash: tokenHash,
      p_purpose: PURPOSE,
    })
    return !error && data === true
  } catch {
    return false
  }
}
