import type { Metadata } from 'next'
import { requireOrganizationOwner } from '@/lib/admin/owner-guard'
import { createClient } from '@/lib/supabase/server'
import { AccountSecurity } from '@/components/admin/AccountSecurity'
import { PageHead, Button } from '@/components/portal/ui'

/** L3 C-04 — konto och säkerhet. Lösenordsbyte + utloggning av andra enheter går
 *  via Supabase Auth. En LISTA över aktiva sessioner går inte att bygga ärligt:
 *  auth-js har inget sessions-API för klienten, så vi visar bara den här enheten. */

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Konto och säkerhet · Adminpanel' }

export default async function KontoPage() {
  await requireOrganizationOwner('installningar')
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  return (
    <section className="portal-section" style={{ maxWidth: '640px' }}>
      <PageHead
        eyebrow="Inställningar"
        title="Konto och säkerhet"
        lede="Ditt lösenord och dina inloggningar."
      />
      <p style={{ margin: '0 0 1rem' }}>
        <Button href="/admin/installningar" variant="ghost" icon="arrowLeft" size="sm">
          Alla inställningar
        </Button>
      </p>

      <AccountSecurity
        email={data.user?.email ?? null}
        lastSignInAt={data.user?.last_sign_in_at ?? null}
      />
    </section>
  )
}
