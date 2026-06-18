import type { Metadata } from 'next'
import { CreateTenantForm } from '@/components/platform/CreateTenantForm'
import { loadVerticalPresets } from '@/lib/platform/verticals'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Onboarda kund' }

// The onboarding wizard owns its own PageHead + intro callout (design "Onboarda ny
// salong"), so the page is just the host section. Multi-bransch (spår 5): we fetch
// the verticals + modules catalog server-side (platform-gated) and pass it down so
// the wizard can lead with "Välj bransch" + prefill the module-state preset.
export default async function NewTenantPage() {
  const presets = await loadVerticalPresets()
  // Sajtbyggare-editorn i onboarding är flagg-gatead (call-time, samma ENV-axel som
  // spike-rutterna): av i prod, på i staging. Flaggan styr CreateTenantForm:s editor-vy.
  const editorEnabled = sajtbyggareEnabled()
  return (
    <section className="portal-section">
      <CreateTenantForm presets={presets} editorEnabled={editorEnabled} />
    </section>
  )
}
