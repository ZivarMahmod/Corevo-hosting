import type { IconName } from '@/components/portal/ui/Icon'

/** Neutral contract shared by tenant and platform settings navigation. */
export type SettingsNavigationCategory = {
  id: string
  group: string
  href: string
  label: string
  hint: string
  icon: IconName
  keywords: string
  warning?: 'warning' | 'danger'
}

export type SettingsNavigationSearchEntry = {
  id: string
  label: string
  hint: string
  categoryId: string
  href: string
  keywords: string
  category: SettingsNavigationCategory
}
