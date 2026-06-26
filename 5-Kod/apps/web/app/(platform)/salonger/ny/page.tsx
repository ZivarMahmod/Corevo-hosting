import type { Metadata } from 'next'
import { CreateTenantForm } from '@/components/platform/CreateTenantForm'
import { OnboardingStudio } from '@/components/platform/onboarding-studio/OnboardingStudio'
import { loadVerticalPresets } from '@/lib/platform/verticals'
import { listTenantsWithStats } from '@/lib/platform/tenants'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { lookMetaList } from '@/lib/sajtbyggare/look-registry'
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
  // goal-50: the BOX of selectable looks. Passed to the studio ONLY when sajtbyggare is
  // ON (the look-gallery + render-bron preview are flag-gated); OFF → [] → legacy theme
  // list, byte-identical. lookMetaList() strips the html, so only key/name/thumbnail/
  // vibe ever reaches the client.
  const looks = editorEnabled ? lookMetaList() : []
  // The studio is a full-screen app (3 columns + live preview), so it runs FULL-BLEED:
  // `onboarding-host` makes portal-main drop its 30px padding + become a flex column so
  // the studio fills the content area edge-to-edge below the topbar (not a boxed card).
  // The legacy form keeps the normal padded `portal-section`.
  return (
    <section className={studioEnabled ? 'onboarding-host' : 'portal-section'}>
      {studioEnabled ? (
        <OnboardingStudio
          presets={presets}
          tenants={await listTenantsWithStats()}
          editorEnabled={editorEnabled}
          looks={looks}
        />
      ) : (
        <CreateTenantForm presets={presets} editorEnabled={editorEnabled} />
      )}
    </section>
  )
}
