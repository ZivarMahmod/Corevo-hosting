import type { ComponentType } from 'react'
import type { StorefrontTheme } from '@/lib/tenant-data'
import type { StorefrontLayoutProps } from './types'
import { SalviaLayout } from './SalviaLayout'
import { LeanderLayout } from './LeanderLayout'
import { ZiggeLayout } from './ZiggeLayout'
import { LinneaLayout } from './LinneaLayout'
import { EditLayout } from './EditLayout'

export type { StorefrontLayoutProps } from './types'

/**
 * One layout per storefront theme. app/(public)/page.tsx resolves
 * `STOREFRONT_LAYOUTS[settings.theme]` and renders it with the tenant bundle.
 * Every theme has an entry (parseTheme guarantees a valid key), so the lookup is
 * total — no runtime fallback needed.
 */
export const STOREFRONT_LAYOUTS: Record<
  StorefrontTheme,
  ComponentType<StorefrontLayoutProps>
> = {
  salvia: SalviaLayout,
  leander: LeanderLayout,
  zigge: ZiggeLayout,
  linnea: LinneaLayout,
  edit: EditLayout,
}
