'use client'

import { SettingsRouteError } from '@/components/admin/SettingsRouteError'

export default function SchedulesError({ reset }: { error: Error; reset: () => void }) {
  return <SettingsRouteError reset={reset} />
}
