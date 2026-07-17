'use client'

import { PlatformError } from '@/components/platform/PlatformError'

/** Gemensamt, sanningsenligt feltillstånd för alla kund-adminens routes. */
export default function AdminRouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PlatformError
      title="Sidan kunde inte laddas"
      message="Något gick fel när informationen hämtades. Ingenting är ändrat — försök igen."
      reset={reset}
    />
  )
}
