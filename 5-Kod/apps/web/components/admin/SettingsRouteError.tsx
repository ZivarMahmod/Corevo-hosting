'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { PlatformError } from '@/components/platform/PlatformError'
import { settingsCategories, type SettingsCategoryId } from '@/lib/admin/settings-map'
import { SettingsWorkspace } from './SettingsWorkspace'

export function SettingsRouteError({ reset }: { reset: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const categories = settingsCategories()
  const fromQuery = searchParams.get('kategori') as SettingsCategoryId | null
  const requested = fromQuery && categories.some((category) => category.id === fromQuery)
    ? fromQuery
    : null
  const byPath = [...categories]
    .sort((a, b) => b.href.length - a.href.length)
    .find((category) => category.href.split(/[?#]/, 1)[0] === pathname)
  const currentCategory = requested ?? byPath?.id ?? 'tjanster'

  return (
    <SettingsWorkspace categories={categories} currentCategory={currentCategory}>
      <PlatformError
        title="Inställningen kunde inte laddas"
        message="Något gick fel när informationen hämtades. Ingenting är ändrat — försök igen."
        reset={reset}
      />
    </SettingsWorkspace>
  )
}
