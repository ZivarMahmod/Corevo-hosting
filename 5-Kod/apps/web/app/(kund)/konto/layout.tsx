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
  return (
    <PortalShell user={user} title="Mitt konto">
      {children}
    </PortalShell>
  )
}
