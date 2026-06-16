// S0 spike — the REAL booking module, server-loaded and mounted for weaving at a
// <corevo-module type="booking"> marker.
//
// There is no BookingSection component (booking is the legacy core module). The
// canonical real-data render is: load WizardService[] server-side (same join as
// app/boka/page.tsx, via getWizardServices) → mount the real <BookingWizard>.
// Because BookingWizard is a client component fed plain serializable props, it
// renders correctly when returned from this async server component — and the data
// is loaded BEFORE render, which is what lets html-react-parser's *synchronous*
// replace() inject an already-resolved element (no await inside replace()).
//
// The woven node carries a STABLE data-corevo-module="booking" attribute: the
// source <corevo-module> marker is consumed by the parser and gone from the DOM,
// so verify_render (F6) asserts THIS attribute (+ a real service name) instead.
import {
  getWizardServices,
  getWizardLocations,
} from '@/components/storefront/wizard-services'
import { BookingWizard } from '@/components/booking/BookingWizard'

export async function BookingMount({
  tenantId,
  slug,
}: {
  tenantId: string
  slug: string
}) {
  const [services, locations] = await Promise.all([
    getWizardServices(tenantId, slug),
    getWizardLocations(tenantId, slug),
  ])
  return (
    <div data-corevo-module="booking" data-corevo-tenant={slug}>
      <BookingWizard services={services} locations={locations} mode="wizard" />
    </div>
  )
}
