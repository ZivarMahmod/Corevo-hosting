'use client'

import { PlatformError } from '@/components/platform/PlatformError'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <PlatformError
      title="Kunde inte ladda översikten"
      message="Plattformsdata gick inte att hämta just nu. Kontrollera din anslutning och försök igen."
      reset={reset}
    />
  )
}
