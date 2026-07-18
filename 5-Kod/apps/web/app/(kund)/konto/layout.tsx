import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePortal } from '@/lib/auth/session'
import { currentTenant } from '@/lib/tenant-data'
import { PortalShell } from '@/components/portal/PortalShell'
import { currentKundTenant } from '@/lib/kund/tenant'
import { canRenderCustomerPortal } from '@/lib/kund/customer-host-fence'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/(auth)/actions'

export const dynamic = 'force-dynamic'

// Plan 015: kund-PWA:n — manifestet gör /konto installerbart ("Lägg till på
// hemskärmen"); service workern registreras av PushOptIn först vid opt-in.
export const metadata: Metadata = { manifest: '/api/pwa/kund-manifest' }

function WrongCustomerHost() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: '#f4f1e9',
        color: '#1c1c1a',
      }}
    >
      <section aria-labelledby="wrong-account-title" style={{ maxWidth: 520 }}>
        <h1 id="wrong-account-title">Kontot kan inte öppnas här</h1>
        <p>
          Du är inloggad med ett konto som inte hör till den här företagssidan.
          Logga ut och öppna länken från rätt företag.
        </p>
        <form action={signOut}>
          <button type="submit">Byt konto</button>
        </form>
      </section>
    </main>
  )
}

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
  const user = await requirePortal('kund')
  const hostTenant = await currentKundTenant()
  const supabase = await createClient()
  const { data: customer } = hostTenant
    ? await supabase
        .from('customers')
        .select('tenant_id, status')
        .eq('auth_user_id', user.id)
        .eq('tenant_id', hostTenant.id)
        .eq('status', 'active')
        .maybeSingle()
    : { data: null }

  if (
    !canRenderCustomerPortal({
      roleLevel: user.roleLevel,
      platformAdmin: user.platformAdmin,
      accountTenantId: user.tenantId,
      hostTenantId: hostTenant?.id ?? null,
      customerTenantId: customer?.tenant_id ?? null,
      customerStatus: customer?.status ?? null,
    })
  ) {
    return <WrongCustomerHost />
  }

  // Branding and every account child are loaded only after the tenant identity
  // fence above has passed. A mismatched account can therefore render neither
  // another tenant's chrome nor its own data under the wrong host.
  const bundle = await currentTenant()
  if (!bundle?.settings.customerAccountsEnabled) notFound()

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
