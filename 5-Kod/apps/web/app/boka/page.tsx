import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { createPublicClient } from '@/lib/supabase/public'
import { BookingWizard, type WizardService } from '@/components/booking/BookingWizard'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Boka tid' }

export default async function BokaPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle

  const services = await getServices(tenant.id, tenant.slug)

  const supabase = createPublicClient()
  const [{ data: staff }, { data: links }] = await Promise.all([
    supabase.from('staff').select('id, title').eq('tenant_id', tenant.id).eq('active', true),
    supabase.from('staff_services').select('staff_id, service_id').eq('tenant_id', tenant.id),
  ])

  const staffById = new Map((staff ?? []).map((s) => [s.id, { id: s.id, title: s.title }]))
  const staffByService: Record<string, { id: string; title: string | null }[]> = {}
  for (const row of links ?? []) {
    const member = staffById.get(row.staff_id)
    if (!member) continue
    ;(staffByService[row.service_id] ??= []).push(member)
  }

  const wizardServices: WizardService[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMin: s.duration_min,
    priceCents: s.price_cents,
    staff: staffByService[s.id] ?? [],
  }))

  return (
    <section className="section">
      <div className="section-inner">
        <h1>Boka tid hos {tenant.name}</h1>
        <p className="prose">Välj tjänst, personal och tid — klart på under en minut.</p>
        <BookingWizard services={wizardServices} />
      </div>
    </section>
  )
}
