'use client'

import dynamic from 'next/dynamic'
import type { SidaStudioV2Props } from './SidaStudioV2'

const SidaStudioV2 = dynamic(
  () => import('./SidaStudioV2').then((module) => module.SidaStudioV2),
  {
    ssr: false,
    loading: () => (
      <section
        className="portal-section"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        Laddar sidstudion…
      </section>
    ),
  },
)

/** Loads the interactive editor as a browser asset; auth and reads stay server-side. */
export function SidaStudioV2Lazy(props: SidaStudioV2Props) {
  return <SidaStudioV2 {...props} />
}
