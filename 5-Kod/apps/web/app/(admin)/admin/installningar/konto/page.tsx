import type { Metadata } from 'next'
import { requireOrganizationOwner } from '@/lib/admin/owner-guard'
import { getAdminTenant } from '@/lib/admin/tenant'
import { createClient } from '@/lib/supabase/server'
import { AccountSecurity } from '@/components/admin/AccountSecurity'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { PageHead } from '@/components/portal/ui'
import { settingsCategories } from '@/lib/admin/settings-map'

/** L3 C-04 — konto och säkerhet. Lösenordsbyte + utloggning av andra enheter går
 *  via Supabase Auth. En LISTA över aktiva sessioner går inte att bygga ärligt:
 *  auth-js har inget sessions-API för klienten, så vi visar bara den här enheten. */

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Konto och säkerhet · Adminpanel' }

export default async function KontoPage() {
  const user = await requireOrganizationOwner('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <SettingsWorkspaceEmpty currentCategory="konto" title="Konto och säkerhet" />

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  return (
    <SettingsWorkspace categories={settingsCategories(tenant.terminology)} currentCategory="konto">
      <section className="portal-section" style={{ maxWidth: '640px' }}>
        <PageHead
          eyebrow="Inställningar"
          title="Konto och säkerhet"
          lede="Ditt lösenord och dina inloggningar."
        />
        <AccountSecurity
          email={data.user?.email ?? null}
          lastSignInAt={data.user?.last_sign_in_at ?? null}
        />
      </section>
    </SettingsWorkspace>
  )
}
