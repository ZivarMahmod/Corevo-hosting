import 'server-only'

import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createServiceClient } from '@/lib/platform/service'
import { resolveCustomerPortalCapabilities } from './mode'

const TENANT_SLUG_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: string) => Query
  maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>
}

type ServiceClient = { from: (table: string) => Query }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function resolvePortalPublicTenant(
  tenantSlug: string,
): Promise<{ tenantName: string } | null> {
  if (!TENANT_SLUG_PATTERN.test(tenantSlug)) return null

  try {
    const client = createServiceClient() as unknown as ServiceClient | null
    if (!client) return null
    const tenantResult = await client
      .from('tenants')
      .select('id,name')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .maybeSingle()
    if (tenantResult.error || !isRecord(tenantResult.data)) return null

    const id = tenantResult.data.id
    const name = tenantResult.data.name
    if (
      typeof id !== 'string' ||
      id.length < 1 ||
      typeof name !== 'string' ||
      name.trim().length < 1 ||
      name.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(name)
    )
      return null

    const settingsResult = await client
      .from('tenant_settings')
      .select('settings')
      .eq('tenant_id', id)
      .maybeSingle()
    if (settingsResult.error || !isRecord(settingsResult.data)) return null
    const settings = settingsResult.data.settings
    if (!resolveCustomerPortalCapabilities(settings).passwordless) return null

    return { tenantName: name.trim() }
  } catch {
    return null
  }
}

export const getPortalPublicTenant = cache(resolvePortalPublicTenant)

export async function requirePortalPublicTenant(params: Promise<{ tenantSlug: string }>) {
  const { tenantSlug } = await params
  const tenant = await getPortalPublicTenant(tenantSlug)
  if (!tenant) notFound()
  return { tenantSlug, tenant }
}
