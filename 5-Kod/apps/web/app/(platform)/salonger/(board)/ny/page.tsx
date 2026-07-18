import type { Metadata } from 'next'
import Link from 'next/link'
import { CreateTenantForm } from '@/components/platform/CreateTenantForm'
import { OnboardingStudio } from '@/components/platform/onboarding-studio/OnboardingStudio'
import { loadVerticalPresets } from '@/lib/platform/verticals'
import { onboardingStudioEnabled } from '@/lib/platform/onboarding-studio/flag'
import styles from '@/components/platform/salonger-v2.module.css'
import { Icon } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Onboarda kund' }

// The onboarding wizard owns its own PageHead + intro callout (design "Onboarda ny
// salong"), so the page is just the host section. Multi-bransch (spår 5): we fetch
// the verticals + modules catalog server-side (platform-gated) and pass it down so
// the wizard can lead with "Välj bransch" + prefill the module-state preset.
export default async function NewTenantPage() {
  const presets = await loadVerticalPresets()
  // goal-48 onboarding-studio: flagg-gatead på SAMMA call-time-axel (av i prod, på i
  // staging). PÅ → den 12-stegs studion (live preview hela vägen); AV → oförändrad
  // CreateTenantForm (byte-identisk). Hämta kundlistan (SuperEntry, §8) bara när studion
  // är på, så OFF-vägen aldrig får en extra cross-tenant-query.
  const studioEnabled = onboardingStudioEnabled()
  // The studio is a full-screen app (3 columns + live preview), so it runs FULL-BLEED:
  // `onboarding-host` makes portal-main drop its 30px padding + become a flex column so
  // the studio fills the content area edge-to-edge below the topbar (not a boxed card).
  // The legacy form keeps the normal padded `portal-section`.
  return (
    <div className={styles.pane}>
      <div className={`${styles.paneInner} ${studioEnabled ? styles.paneInnerWide : ''}`}>
        <Link href="/salonger" className={styles.back}>
          <Icon name="arrowLeft" size={15} />
          Kunder
        </Link>
        <section className={studioEnabled ? 'onboarding-host' : 'portal-section'}>
          {studioEnabled ? (
            <OnboardingStudio presets={presets} />
          ) : (
            <CreateTenantForm presets={presets} />
          )}
        </section>
      </div>
    </div>
  )
}
