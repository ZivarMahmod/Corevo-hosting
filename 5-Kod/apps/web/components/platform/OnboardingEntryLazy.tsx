'use client'

import dynamic from 'next/dynamic'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'

const OnboardingStudio = dynamic(
  () => import('./onboarding-studio/OnboardingStudio').then((module) => module.OnboardingStudio),
  { ssr: false, loading: () => <div aria-busy="true">Laddar onboardingstudion…</div> },
)

/** Loads the onboarding studio as a browser asset, outside the Worker. */
export function OnboardingEntryLazy({
  presets,
}: {
  presets: VerticalPresetData
}) {
  return <OnboardingStudio presets={presets} />
}
