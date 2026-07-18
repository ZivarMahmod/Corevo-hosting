'use client'

import dynamic from 'next/dynamic'
import type { SidaStudioProps } from './SidaStudio'

const SidaStudio = dynamic(
  () => import('./SidaStudio').then((module) => module.SidaStudio),
  {
    ssr: false,
    loading: () => (
      <section
        className="portal-section"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        Laddar sidverktygen…
      </section>
    ),
  },
)

/** Loads the interactive site tools as a browser asset; tenant scoping stays server-side. */
export function SidaStudioLazy(props: SidaStudioProps) {
  return <SidaStudio {...props} />
}
