'use client'

import { PlatformError } from '@/components/platform/PlatformError'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <PlatformError
      title="Kunde inte ladda faktureringsunderlaget"
      message="Underlaget gick inte att räkna fram just nu. Försök igen."
      reset={reset}
    />
  )
}
