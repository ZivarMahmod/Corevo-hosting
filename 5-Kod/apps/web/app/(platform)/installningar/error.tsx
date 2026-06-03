'use client'

import { PlatformError } from '@/components/platform/PlatformError'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <PlatformError
      title="Kunde inte ladda inställningar"
      message="Plattformsinställningarna gick inte att visa just nu. Försök igen."
      reset={reset}
    />
  )
}
