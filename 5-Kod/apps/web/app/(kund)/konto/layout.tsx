import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { requirePortal } from '@/lib/auth/session'
import { currentTenant } from '@/lib/tenant-data'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

/**
 * Auth fence for the whole /konto/* subtree: requires a logged-in customer
 * (level >= kund). Unauthenticated → redirect to /login (the middleware also
 * gates this cheaply; this is the authoritative DAL re-check). Wraps every
 * account page in the shared, tenant-themed portal chrome.
 *
 * G12: the account area only exists on a storefront whose owner enabled customer
 * accounts. Checked BEFORE auth so a disabled tenant 404s for everyone (and a
 * booking-host visit, where there is no host tenant, 404s too).
 */
export default async function KontoLayout({ children }: { children: React.ReactNode }) {
  const bundle = await currentTenant()
  if (!bundle?.settings.customerAccountsEnabled) notFound()
  const user = await requirePortal('kund')
  const { branding, theme } = bundle.settings

  // The /konto subtree is a STOREFRONT surface (the salon's own product), so it
  // carries the storefront world + the salon's theme. data-world, data-theme AND
  // injectTenantTokens MUST sit on the SAME element: the theme tokens in
  // packages/ui/tokens.css are keyed on the compound [data-world="storefront"]
  // [data-theme="…"], and the inline per-tenant overrides (injectTenantTokens) must
  // win over that rule — which only holds when both live on one element. PortalShell
  // (out of revir) doesn't apply a theme, so we set all three here on our own wrapper.
  return (
    <PortalShell user={user} title="Mitt konto">
      <div
        data-world="storefront"
        data-theme={theme}
        data-tenant={bundle.tenant.id}
        style={injectTenantTokens(branding) as CSSProperties}
      >
        {children}
      </div>
    </PortalShell>
  )
}
