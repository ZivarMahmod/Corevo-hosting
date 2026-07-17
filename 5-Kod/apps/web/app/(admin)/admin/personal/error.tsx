'use client'

import { SettingsRouteError } from '@/components/admin/SettingsRouteError'

export default function StaffError({ reset }: { error: Error; reset: () => void }) {
  return <SettingsRouteError reset={reset} />
}
