'use client'

import dynamic from 'next/dynamic'
import type { CalendarBoardProps } from './CalendarBoard'

const CalendarBoard = dynamic(
  () => import('./CalendarBoard').then((module) => module.CalendarBoard),
  {
    ssr: false,
    loading: () => (
      <section
        className="portal-section"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        Laddar kalendern…
      </section>
    ),
  },
)

/** Loads the interactive calendar as a browser asset; auth and reads stay server-side. */
export function CalendarBoardLazy(props: CalendarBoardProps) {
  return <CalendarBoard {...props} />
}
