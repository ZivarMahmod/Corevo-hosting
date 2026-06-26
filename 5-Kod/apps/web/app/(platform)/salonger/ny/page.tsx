import type { Metadata } from 'next'
import { CreateTenantForm } from '@/components/platform/CreateTenantForm'
import { OnboardingStudio } from '@/components/platform/onboarding-studio/OnboardingStudio'
import { loadVerticalPresets } from '@/lib/platform/verticals'
import { listTenantsWithStats } from '@/lib/platform/tenants'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { onboardingStudioEnabled } from '@/lib/platform/onboarding-studio/flag'

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
  // goal-48 onboarding-studio: flagg-gatead på SAMMA call-time-axel (av i prod, på i
  // staging). PÅ → den 12-stegs studion (live preview hela vägen); AV → oförändrad
  // CreateTenantForm (byte-identisk). Hämta kundlistan (SuperEntry, §8) bara när studion
  // är på, så OFF-vägen aldrig får en extra cross-tenant-query.
  const studioEnabled = onboardingStudioEnabled()
  return (
    <section className="portal-section">
      {studioEnabled ? (
        <OnboardingStudio
          presets={presets}
          tenants={await listTenantsWithStats()}
          editorEnabled={editorEnabled}
        />
      ) : (
        <CreateTenantForm presets={presets} editorEnabled={editorEnabled} />
      )}
    </section>
  )
}
