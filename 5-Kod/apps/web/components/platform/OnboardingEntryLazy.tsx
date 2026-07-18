'use client'

import dynamic from 'next/dynamic'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'

const OnboardingStudio = dynamic(
  () => import('./onboarding-studio/OnboardingStudio').then((module) => module.OnboardingStudio),
  { ssr: false, loading: () => <div aria-busy="true">Laddar onboardingstudion…</div> },
)

const CreateTenantForm = dynamic(
  () => import('./CreateTenantForm').then((module) => module.CreateTenantForm),
  { ssr: false, loading: () => <div aria-busy="true">Laddar kundformuläret…</div> },
)

/** Loads the selected onboarding surface as a browser asset, outside the Worker. */
export function OnboardingEntryLazy({
  presets,
  studioEnabled,
}: {
  presets: VerticalPresetData
  studioEnabled: boolean
}) {
  return studioEnabled
    ? <OnboardingStudio presets={presets} />
    : <CreateTenantForm presets={presets} />
}
