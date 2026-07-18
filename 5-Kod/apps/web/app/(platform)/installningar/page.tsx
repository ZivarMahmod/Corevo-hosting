import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { requirePlatformAdmin } from '@/lib/auth/session'
import {
  PLATFORM_SETTINGS_GROUPS,
  platformSettingsCategories,
  platformSettingsSearchEntries,
} from '@/lib/platform/settings-map'
import { createClient } from '@/lib/supabase/server'
import { BillingSettings, SecuritySettings } from './Settings'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Inställningar' }

export default async function InstallningarPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string | string[] }>
}) {
  await requirePlatformAdmin()
  const requestedValue = (await searchParams).kategori
  const requestedCategory = Array.isArray(requestedValue) ? requestedValue[0] : requestedValue
  const categories = platformSettingsCategories()
  const category = categories.find((item) => item.id === (requestedCategory ?? 'sakerhet'))
  if (!category) redirect('/installningar')

  let content
  if (category.id === 'sakerhet') {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    content = (
      <SecuritySettings
        email={data.user?.email ?? null}
        lastSignInAt={data.user?.last_sign_in_at ?? null}
      />
    )
  } else {
    content = <BillingSettings />
  }

  return (
    <SettingsWorkspace
      categories={categories}
      currentCategory={category.id}
      rootHref="/installningar"
      groups={PLATFORM_SETTINGS_GROUPS}
      searchEntries={platformSettingsSearchEntries(categories)}
      mobileIndex={!requestedCategory}
    >
      {content}
    </SettingsWorkspace>
  )
}
