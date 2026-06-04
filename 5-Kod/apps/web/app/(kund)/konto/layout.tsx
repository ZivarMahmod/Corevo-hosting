import { notFound } from 'next/navigation'
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

  // The /konto subtree is a STOREFRONT surface (the salon's own product), so it
  // carries the storefront world + the salon's theme. PortalShell now applies all
  // three on its kund-branch root — data-world, data-theme AND the inline
  // injectTenantTokens overrides on the SAME element (the override must beat the
  // compound [data-world="storefront"][data-theme="…"] rule in packages/ui/tokens.css,
  // which only holds when both live on one element) — so the salon header is themed
  // alongside the body. No inner wrapper needed.
  return (
    <PortalShell user={user} title="Mina sidor" world="storefront" theme={bundle.settings.theme}>
      {children}
    </PortalShell>
  )
}
