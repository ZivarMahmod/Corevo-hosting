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
import {
  readPickerMode,
  readStaffAvatarMode,
  type PickerMode,
  type StaffAvatarMode,
} from '@/lib/platform/booking-variant'
import type { WizardService, WizardLocation } from '@/components/booking/BookingWizard'

type StaffMember = { id: string; title: string | null; locationIds: string[]; avatarUrl: string | null }

const loadStaffByService = (tenantId: string, slug: string) =>
  unstable_cache(
    async (): Promise<Record<string, StaffMember[]>> => {
      const supabase = createPublicClient()
      // working_hours.location_id (VÅG 4b): en frisör är bokningsbar på plats L iff
      // hen har ≥1 working_hours-rad med location_id = L. Vi laddar (staff_id,
      // location_id) och bygger en distinct-uppsättning per frisör så pickern kan
      // dölja fel-plats-personal (speglar availability-motorns scope i actions.ts).
      const [{ data: staff }, { data: links }, { data: hours }] = await Promise.all([
        supabase
          .from('staff')
          // avatar_url (0049): barberarkortets foto-läge; null → initialer-fallback.
          .select('id, title, avatar_url')
          .eq('tenant_id', tenantId)
          .eq('active', true),
        supabase
          .from('staff_services')
          .select('staff_id, service_id')
          .eq('tenant_id', tenantId),
        supabase
          .from('working_hours')
          .select('staff_id, location_id')
          .eq('tenant_id', tenantId),
      ])
      // staff_id → Set<location_id> (distinct, hoppa över null location_id).
      const locationsByStaff = new Map<string, Set<string>>()
      for (const row of hours ?? []) {
        if (!row.location_id) continue
        ;(locationsByStaff.get(row.staff_id) ?? locationsByStaff.set(row.staff_id, new Set()).get(row.staff_id)!).add(
          row.location_id,
        )
      }
      const staffById = new Map(
        (staff ?? []).map(
          (s) =>
            [
              s.id,
              {
                id: s.id,
                title: s.title,
                locationIds: [...(locationsByStaff.get(s.id) ?? [])],
                avatarUrl: s.avatar_url ?? null,
              } as StaffMember,
            ] as const,
        ),
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

/** Active locations for a tenant, shaped for <BookingWizard>'s location picker
 *  (primary first). Mirrors the /boka route's load so the in-page drawer offers
 *  the SAME location selection. A 1-location tenant → the wizard hides the picker. */
export async function getWizardLocations(
  tenantId: string,
  slug: string,
): Promise<WizardLocation[]> {
  return unstable_cache(
    async (): Promise<WizardLocation[]> => {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('locations')
        .select('id, name, is_primary')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('is_primary', { ascending: false })
        .order('name', { ascending: true })
      return (data ?? []).map((l) => ({ id: l.id, name: l.name, isPrimary: l.is_primary }))
    },
    ['wizard-locations', tenantId],
    { tags: [`tenant:${slug.trim().toLowerCase()}`], revalidate: 300 },
  )()
}

/** Redesign-prefs för bokningsytan (design-paketet): tid-väljare + barberarbild-
 *  läge. Rå-läses ur tenant_settings.settings via SAMMA seam som readBookingVariant
 *  (readPickerMode/readStaffAvatarMode äger parse + default + tolerans), cachat per
 *  tenant precis som services/locations ovan. Osatt/okänt → calendar / initialer. */
export type BookingPrefs = { pickerMode: PickerMode; staffAvatarMode: StaffAvatarMode }

export async function getBookingPrefs(tenantId: string, slug: string): Promise<BookingPrefs> {
  return unstable_cache(
    async (): Promise<BookingPrefs> => {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('tenant_settings')
        .select('settings')
        .eq('tenant_id', tenantId)
        .maybeSingle()
      return {
        pickerMode: readPickerMode(data?.settings),
        staffAvatarMode: readStaffAvatarMode(data?.settings),
      }
    },
    ['booking-prefs', tenantId],
    { tags: [`tenant:${slug.trim().toLowerCase()}`], revalidate: 300 },
  )()
}
