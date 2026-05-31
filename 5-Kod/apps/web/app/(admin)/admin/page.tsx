import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Salongsadmin' }

export default async function AdminPage() {
  // RLS scopes every count to the admin's own tenant.
  const supabase = await createClient()
  const [services, staff, bookings] = await Promise.all([
    supabase.from('services').select('*', { count: 'exact', head: true }),
    supabase.from('staff').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
  ])

  const stats: { label: string; value: number }[] = [
    { label: 'Tjänster', value: services.count ?? 0 },
    { label: 'Personal', value: staff.count ?? 0 },
    { label: 'Bokningar', value: bookings.count ?? 0 },
  ]

  return (
    <section className="portal-section">
      <h1>Salongsadmin</h1>
      <p className="prose">Översikt för din salong. Full administration byggs i G06.</p>
      <ul className="portal-stats">
        {stats.map((s) => (
          <li key={s.label} className="portal-stat">
            <span className="portal-stat-value">{s.value}</span>
            <span className="portal-stat-label">{s.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
