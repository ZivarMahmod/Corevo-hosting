import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'
import { getCurrentUser } from '@/lib/auth/session'
import { portalHomeFor } from '@/lib/auth/roles'
import { SignUpForm } from '@/components/kund/SignUpForm'

// Per-request, host-resolved tenant theme → never prerender.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Skapa konto' }

export default async function RegistreraPage() {
  // Already signed in → straight to the role-appropriate portal home.
  const user = await getCurrentUser()
  if (user) redirect(portalHomeFor(user))

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
          <SignUpForm />
        </div>
      </main>
    </div>
  )
}
