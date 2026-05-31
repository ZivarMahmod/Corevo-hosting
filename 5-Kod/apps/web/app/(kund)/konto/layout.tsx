import { requirePortal } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

/**
 * Auth fence for the whole /konto/* subtree: requires a logged-in customer
 * (level >= kund). Unauthenticated → redirect to /login (the middleware also
 * gates this cheaply; this is the authoritative DAL re-check). Wraps every
 * account page in the shared, tenant-themed portal chrome.
 */
export default async function KontoLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal('kund')
  return (
    <PortalShell user={user} title="Mitt konto">
      {children}
    </PortalShell>
  )
}
