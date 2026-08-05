import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getCurrentUser } from '@/lib/auth/session'
import { currentRequestTenant, currentTenant } from '@/lib/tenant-data'
import { getTenantFromHost, isPreviewHost } from '@/lib/tenant'
import {
  loginAccessForHost,
  loginDestinationForHost,
  portalHomeFor,
  resolveLoginHostKind,
} from '@/lib/auth/roles'
import { safeInternalRedirectPath } from '@/lib/auth/internal-redirect'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Logga in' }

async function assertTenantLoginAvailable() {
  const host = (await headers()).get('host')
  const resolved = getTenantFromHost(host)
  const bundle = await currentTenant()

  if (
    (resolved.kind === 'tenant' && !bundle) ||
    (bundle && (
      bundle.settings.portalMode !== 'legacy_account' ||
      !bundle.settings.customerAccountsEnabled
    ))
  ) notFound()
}

async function existingSessionDestination(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  next: string | null,
) {
  if (!user) return null
  const home = portalHomeFor(user)
  const host = (await headers()).get('host')
  if (isPreviewHost(host)) return next ?? home

  const resolved = getTenantFromHost(host)
  const hostTenant = await currentRequestTenant()
  const hostKind = resolveLoginHostKind(resolved, Boolean(hostTenant))

  const allowed = loginAccessForHost({
    roleLevel: user.roleLevel,
    platformAdmin: user.platformAdmin,
    partnerAdmin: user.partnerAdmin,
    accountTenantId: user.tenantId,
    hostKind,
    hostTenantId: hostTenant?.id ?? null,
  }).allowed
  return allowed ? loginDestinationForHost({ home, next, hostKind }) : null
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const sp = await searchParams
  const next = safeInternalRedirectPath(sp.next)
  await assertTenantLoginAvailable()
  const user = await getCurrentUser()
  const destination = await existingSessionDestination(user, next)
  if (destination) redirect(destination)
  return <LoginForm next={next ?? ''} />
}
