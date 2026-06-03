import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { PageHead } from '@/components/portal/ui'
import { Settings } from './Settings'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Inställningar' }

/**
 * Inställningar (goal-17 PLATFORM). EXACT-copy of the design-system law source
 * (components/SuperPlatform.jsx → SuperSettings): plattformsövergripande reglage —
 * Säkerhet · Drift · Fakturering.
 *
 * No live read is needed: there is NO platform-settings store (foundation confirmed
 * a backing table is out of the frozen migration scope), so the security/drift
 * reglage are rendered honestly read-only ("Kommer snart", disabled) and the two
 * genuine signals (the audit-guard build-once-never-delete invariant + the manual
 * flöde-2 billing posture) are stated as the architectural facts they are. The view
 * therefore takes no props — see Settings.tsx for the honesty contract per reglage.
 */
export default async function InstallningarPage() {
  // Strict role fence — also enforced by the (platform) layout; kept explicit per
  // the goal-17 self-gate rule (every platform page re-checks requirePlatformAdmin).
  await requirePlatformAdmin()

  return (
    <section className="portal-section">
      <PageHead
        eyebrow="Plattform"
        title="Inställningar"
        lede="Plattformsövergripande reglage. Varje reglage som är kopplat är sant-kopplat — inga döda kontroller."
      />
      <Settings />
    </section>
  )
}
