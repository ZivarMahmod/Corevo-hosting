import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { createPublicClient } from '@/lib/supabase/public'
import { readBookingMode, readPickerMode, readStaffAvatarMode } from '@/lib/platform/booking-variant'
import {
  BookingWizard,
  type WizardService,
  type WizardLocation,
} from '@/components/booking/BookingWizard'
import { resolveStaffNoun } from '@/components/storefront/staff-noun'
import { branschBokning } from '@/components/storefront/bransch-copy'
import { getTenantModuleStates } from '@/lib/tenant-modules'
import { bookingModuleAccess } from '@/components/storefront/layouts/booking-access'
import { resolveBookingSearchParams } from '@/lib/booking/preselection'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Boka tid' }

/**
 * goal-64 — DJUPLÄNKEN IN I BOKNINGEN (HANDOFF §4: "teamkorten och prisraderna
 * förifyller bokningen via bookAs() — behåll den kopplingen").
 *
 *   /boka?personal=<staffId>          → medarbetaren förvald i "Hos vem?"-steget
 *   /boka?personal=<id>&tjanst=<id>   → + tjänsten förvald (wizarden startar på steg 2)
 *   /boka?tjanst=<serviceId>          → bara tjänsten (prisradens länk)
 *   /boka?plats=<locationId>          → aktiv plats förvald
 *
 * Parametrarna är REN UI-FÖRIFYLLNAD och valideras av wizarden mot den data den redan
 * har (okänt id / personal som inte kan utföra tjänsten → tyst 'any'). Servern validerar
 * ändå allt igen i createBooking, så en manipulerad url kan inte boka något otillåtet.
 * Svenska parameternamn eftersom hela storefronten är svensk och länken syns i adressfältet.
 */
export default async function BokaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const bookingAccess = bookingModuleAccess(await getTenantModuleStates(tenant.id, tenant.slug))
  if (bookingAccess === 'hidden') notFound()

  // BRANSCH-REGELN: verbet kommer ur bransch-lagret, aldrig hårdkodat. En florist
  // bokar konsultation, en restaurang bokar bord — inte "tid".
  const bokning = branschBokning(tenant.vertical_id)
  if (bookingAccess === 'paused') {
    return (
      <section className="section">
        <div className="section-inner">
          <h1>
            {bokning.hosPrefix} {tenant.name}
          </h1>
          <p className="prose">Onlinebokningen är tillfälligt pausad. Kontakta verksamheten för hjälp.</p>
        </div>
      </section>
    )
  }

  const sp = await searchParams
  const one = (v: string | string[] | undefined): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null
  const preselectStaffId = one(sp.personal)

  const services = await getServices(tenant.id, tenant.slug)

  const supabase = createPublicClient()
  const [
    { data: staff },
    { data: links },
    { data: hours },
    { data: settingsRow },
    { data: locationRows },
  ] = await Promise.all([
      // avatar_url (0049): barberarkortets foto-läge; null → initialer-fallback.
      supabase.from('staff').select('id, title, avatar_url').eq('tenant_id', tenant.id).eq('active', true),
      supabase.from('staff_services').select('staff_id, service_id').eq('tenant_id', tenant.id),
      // working_hours.location_id (VÅG 4b): en frisör är bokningsbar på plats L iff
      // hen har ≥1 rad med location_id = L. Speglar wizard-services.ts så den
      // fristående /boka-rutten och in-page-drawern filtrerar personal identiskt.
      supabase.from('working_hours').select('staff_id, location_id').eq('tenant_id', tenant.id),
      // Variant-val (M7 §2.4) ligger i raw `tenant_settings.settings.booking.variant`
      // — samma raw-read-söm som getGoogleReviewUrl, INTE den frysta parseSettings-
      // bundlen. Osatt/okänd → readBookingMode faller tillbaka på 'wizard' (Variant 3
      // = exakt dagens flöde).
      supabase.from('tenant_settings').select('settings').eq('tenant_id', tenant.id).maybeSingle(),
      // Aktiva platser (VÅG 4b): location-picker i wizarden. Primär först. En-plats-
      // salonger → picker döljs och auto-väljs i klienten (UX oförändrad).
      supabase
        .from('locations')
        .select('id, name, is_primary')
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .order('is_primary', { ascending: false })
        .order('name', { ascending: true }),
    ])
  const mode = readBookingMode(settingsRow?.settings)
  // Redesign-prefs (design-paketet): tid-väljare + barberarbild-läge, samma
  // raw-read-seam som variant-valet. Osatt → calendar / initialer.
  const pickerMode = readPickerMode(settingsRow?.settings)
  const staffAvatarMode = readStaffAvatarMode(settingsRow?.settings)
  // Bransch-resolved staff noun (default 'Frisör') for the customer-facing wizard.
  const staffNoun = await resolveStaffNoun(tenant.vertical_id)
  const locations: WizardLocation[] = (locationRows ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    isPrimary: l.is_primary,
  }))

  // staff_id → Set<location_id> (distinct, hoppa över null) — samma karta som
  // wizard-services.ts bygger, så båda /boka-vägarna scopar personal likadant.
  const locationsByStaff = new Map<string, Set<string>>()
  for (const row of hours ?? []) {
    if (!row.location_id) continue
    ;(locationsByStaff.get(row.staff_id) ?? locationsByStaff.set(row.staff_id, new Set()).get(row.staff_id)!).add(
      row.location_id,
    )
  }
  const staffById = new Map(
    (staff ?? []).map((s) => [
      s.id,
      {
        id: s.id,
        title: s.title,
        locationIds: [...(locationsByStaff.get(s.id) ?? [])],
        avatarUrl: s.avatar_url ?? null,
      },
    ]),
  )
  const staffByService: Record<
    string,
    { id: string; title: string | null; locationIds: string[]; avatarUrl: string | null }[]
  > = {}
  for (const row of links ?? []) {
    const member = staffById.get(row.staff_id)
    if (!member) continue
    ;(staffByService[row.service_id] ??= []).push(member)
  }

  const wizardServices: WizardService[] = services.map((s) => ({
    id: s.id,
    locationId: s.location_id,
    name: s.name,
    description: s.description,
    durationMin: s.duration_min,
    priceCents: s.price_cents,
    staff: staffByService[s.id] ?? [],
  }))
  // Queryförval är aldrig en egen trust path. Bara id:n som finns bland de redan
  // tenant-skopade AKTIVA raderna ovan får nå klienten. Live-dialekten är
  // `plats`/`tjanst`; designpaketets `location`/`service` accepteras som alias.
  const preselection = resolveBookingSearchParams({
    searchParams: sp,
    locations,
    services: wizardServices,
  })

  return (
    <section className="section">
      <div className="section-inner">
        <h1>
          {bokning.hosPrefix} {tenant.name}
        </h1>
        <p className="prose">{bokning.lede}</p>
        <BookingWizard
          services={wizardServices}
          locations={locations}
          mode={mode}
          staffNoun={staffNoun}
          bokaCta={bokning.cta}
          pickerMode={pickerMode}
          staffAvatarMode={staffAvatarMode}
          brandName={tenant.name}
          preselectLocationId={preselection.locationId}
          preselectServiceId={preselection.serviceId}
          preselectStaffId={preselectStaffId}
        />
      </div>
    </section>
  )
}
