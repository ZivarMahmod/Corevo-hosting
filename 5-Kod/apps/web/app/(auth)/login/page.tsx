import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getCurrentUser } from '@/lib/auth/session'
import { currentKundTenant } from '@/lib/kund/tenant'
import { getTenantFromHost, isPreviewHost } from '@/lib/tenant'
import { loginAccessForHost, portalHomeFor, type LoginHostKind } from '@/lib/auth/roles'
import { safeInternalRedirectPath } from '@/lib/auth/internal-redirect'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Logga in' }

async function canRedirectExistingSession(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return false
  const host = (await headers()).get('host')
  if (isPreviewHost(host)) return true

  const resolved = getTenantFromHost(host)
  const hostTenant = await currentKundTenant()
  const hostKind: LoginHostKind =
    resolved.kind === 'superadmin' ||
    resolved.kind === 'platform' ||
    resolved.kind === 'staff_portal'
      ? resolved.kind
      : hostTenant
        ? 'tenant'
        : 'other'

  return loginAccessForHost({
    roleLevel: user.roleLevel,
    platformAdmin: user.platformAdmin,
    partnerAdmin: user.partnerAdmin,
    accountTenantId: user.tenantId,
    hostKind,
    hostTenantId: hostTenant?.id ?? null,
  }).allowed
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const sp = await searchParams
  const next = safeInternalRedirectPath(sp.next)
  const user = await getCurrentUser()
  if (user && (await canRedirectExistingSession(user))) {
    redirect(next ?? portalHomeFor(user))
  }
  return <LoginForm next={next ?? ''} />
}
