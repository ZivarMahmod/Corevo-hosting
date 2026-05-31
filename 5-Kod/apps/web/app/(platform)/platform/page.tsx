import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform' }

export default async function PlatformPage() {
  // platform_admin → RLS grants cross-tenant read (private.is_platform_admin()).
  // Seeing MORE than one tenant here is the proof that "platform når tvärs".
  const supabase = await createClient()
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name, status')
    .order('slug')

  return (
    <section className="portal-section">
      <h1>Plattform</h1>
      <p className="prose">
        Alla salonger på plattformen ({tenants?.length ?? 0} st). Du ser tvärs över
        tenants tack vare den globala rollen.
      </p>
      <table className="portal-table">
        <thead>
          <tr>
            <th>Slug</th>
            <th>Namn</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(tenants ?? []).map((t) => (
            <tr key={t.id}>
              <td>{t.slug}</td>
              <td>{t.name}</td>
              <td>{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
