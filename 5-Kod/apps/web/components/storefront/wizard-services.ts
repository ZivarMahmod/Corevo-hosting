// Server helper: build the WizardService[] the embedded BookingWizard expects,
// identical to app/boka/page.tsx (services + staff + staff_services join), so the
// in-page drawer behaves exactly like the /boka route.
//
// The (public) layout now runs this on EVERY public page (it renders the booking
// provider), so the staff/links query is wrapped in unstable_cache (per tenant,
// tag-revalidated) to avoid a DB round-trip on each navigation.
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { getServices } from '@/lib/tenant-data'
import type { WizardService } from '@/components/booking/BookingWizard'

type StaffMember = { id: string; title: string | null }

const loadStaffByService = (tenantId: string, slug: string) =>
  unstable_cache(
    async (): Promise<Record<string, StaffMember[]>> => {
      const supabase = createPublicClient()
      const [{ data: staff }, { data: links }] = await Promise.all([
        supabase
          .from('staff')
          .select('id, title')
          .eq('tenant_id', tenantId)
          .eq('active', true),
        supabase
          .from('staff_services')
          .select('staff_id, service_id')
          .eq('tenant_id', tenantId),
      ])
      const staffById = new Map(
        (staff ?? []).map((s) => [s.id, { id: s.id, title: s.title } as StaffMember]),
      )
      const byService: Record<string, StaffMember[]> = {}
      for (const row of links ?? []) {
        const member = staffById.get(row.staff_id)
        if (!member) continue
        ;(byService[row.service_id] ??= []).push(member)
      }
      return byService
    },
    ['wizard-staff-by-service', tenantId],
    { tags: [`tenant:${slug.trim().toLowerCase()}`], revalidate: 300 },
  )()

/** All bookable services for a tenant, shaped for <BookingWizard>. */
export async function getWizardServices(
  tenantId: string,
  slug: string,
): Promise<WizardService[]> {
  const [services, staffByService] = await Promise.all([
    getServices(tenantId, slug),
    loadStaffByService(tenantId, slug),
  ])
  return services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMin: s.duration_min,
    priceCents: s.price_cents,
    staff: staffByService[s.id] ?? [],
  }))
}
