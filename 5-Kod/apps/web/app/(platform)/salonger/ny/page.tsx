import type { Metadata } from 'next'
import { CreateTenantForm } from '@/components/platform/CreateTenantForm'
import { loadVerticalPresets } from '@/lib/platform/verticals'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Onboarda kund' }

// The onboarding wizard owns its own PageHead + intro callout (design "Onboarda ny
// salong"), so the page is just the host section. Multi-bransch (spår 5): we fetch
// the verticals + modules catalog server-side (platform-gated) and pass it down so
// the wizard can lead with "Välj bransch" + prefill the module-state preset.
export default async function NewTenantPage() {
  const presets = await loadVerticalPresets()
  return (
    <section className="portal-section">
      <CreateTenantForm presets={presets} />
    </section>
  )
}
