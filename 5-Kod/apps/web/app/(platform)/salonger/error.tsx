'use client'

import { PlatformError } from '@/components/platform/PlatformError'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <PlatformError
      title="Kunde inte ladda salongerna"
      message="Salongslistan gick inte att hämta just nu. Försök igen."
      reset={reset}
    />
  )
}
