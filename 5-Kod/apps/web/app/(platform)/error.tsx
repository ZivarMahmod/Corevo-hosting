'use client'

import { PlatformError } from '@/components/platform/PlatformError'

/** Shared retry boundary for platform routes without a local error.tsx. */
export default function PlatformRouteError({ reset }: { error: Error; reset: () => void }) {
  return <PlatformError reset={reset} />
}
