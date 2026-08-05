import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { BookingWizard } from '@/components/booking/BookingWizard'
import {
  getBookingPrefs,
  getWizardLocations,
  getWizardServices,
} from '@/components/storefront/wizard-services'
import { resolveStaffNoun } from '@/lib/storefront/staff-noun'
import { branschBokning } from '@/lib/storefront/bransch-copy'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import {
  resolveBookingSearchParams,
  resolveBookingStaffSearchParam,
} from '@/lib/booking/preselection'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Boka tid' }

/**
 * Djup-länkar förifyller bara redan tenant-skopad, aktiv bokningsdata.
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
  const { tenant, settings } = bundle
  if (!isModuleLive(await getTenantModuleStates(tenant.id, tenant.slug), 'booking')) notFound()
  if (settings.bookingProvider === 'external') {
    if (!settings.bookingExternalUrl) notFound()
    redirect(settings.bookingExternalUrl)
  }

  // BRANSCH-REGELN: verbet kommer ur bransch-lagret, aldrig hårdkodat. En florist
  // bokar konsultation, en restaurang bokar bord — inte "tid".
  const bokning = branschBokning(tenant.vertical_id)
  const [sp, wizardServices, locations, bookingPrefs, staffNoun] = await Promise.all([
    searchParams,
    getWizardServices(tenant.id, tenant.slug),
    getWizardLocations(tenant.id, tenant.slug),
    getBookingPrefs(tenant.id, tenant.slug),
    resolveStaffNoun(tenant.vertical_id),
  ])
  const wizardStaff = [
    ...new Map(
      wizardServices.flatMap((service) => service.staff).map((member) => [member.id, member]),
    ).values(),
  ]
  // Queryförval är aldrig en egen trust path. Bara id:n som finns bland de redan
  // tenant-skopade AKTIVA raderna ovan får nå klienten. Live-dialekten är
  // `plats`/`tjanst`; designpaketets `location`/`service` accepteras som alias.
  const preselection = resolveBookingSearchParams({
    searchParams: sp,
    locations,
    services: wizardServices,
  })
  const preselectStaffId = resolveBookingStaffSearchParam({
    searchParams: sp,
    staff: wizardStaff,
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
          mode={bookingPrefs.mode}
          staffNoun={staffNoun}
          bokaCta={bokning.cta}
          pickerMode={bookingPrefs.pickerMode}
          staffAvatarMode={bookingPrefs.staffAvatarMode}
          brandName={tenant.name}
          countryCode={settings.countryCode}
          locale={settings.locale}
          currency={settings.currency}
          defaultTimeZone={settings.defaultTimeZone}
          preselectLocationId={preselection.locationId}
          preselectServiceId={preselection.serviceId}
          preselectStaffId={preselectStaffId}
        />
      </div>
    </section>
  )
}
