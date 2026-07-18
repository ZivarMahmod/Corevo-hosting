import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'
import { getCurrentUser } from '@/lib/auth/session'
import { portalHomeFor } from '@/lib/auth/roles'
import { safeInternalRedirectPath } from '@/lib/auth/internal-redirect'
import { isCustomerClaimPath } from '@/lib/kund/customer-claim'
import { SignUpForm } from '@/components/kund/SignUpForm'

// Per-request, host-resolved tenant theme → never prerender.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Skapa konto' }

export default async function RegistreraPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const sp = await searchParams
  const next = safeInternalRedirectPath(sp.next)
  // Pilot contract: open auto-confirmed registration is disabled. A new account
  // may only be created while carrying an expiring customer claim link.
  if (!isCustomerClaimPath(next)) notFound()
  // Already signed in → straight to the role-appropriate portal home.
  const user = await getCurrentUser()
  if (user) redirect(next ?? portalHomeFor(user))

  const bundle = await currentTenant()
  // G12: signup exists only when the storefront owner enabled customer accounts.
  if (!bundle?.settings.customerAccountsEnabled) notFound()
  const branding = bundle.settings.branding ?? {}
  const tenantName = bundle.tenant.name ?? 'Corevo'

  return (
    <div
      className="tenant-root auth-root"
      data-tenant={bundle?.tenant.id}
      style={injectTenantTokens(branding) as CSSProperties}
    >
      <main className="auth-main">
        <div className="auth-card">
          <p className="auth-brand">{tenantName}</p>
          <SignUpForm next={next} />
        </div>
      </main>
    </div>
  )
}
