import type { ComponentType } from 'react'
import type { StorefrontTheme } from '@/lib/tenant-data'
import type { StorefrontLayoutProps } from './types'
import { SalviaLayout } from './SalviaLayout'
import { LeanderLayout } from './LeanderLayout'
import { ZiggeLayout } from './ZiggeLayout'
import { LinneaLayout } from './LinneaLayout'
import { EditLayout } from './EditLayout'
import { FloraLayout } from './FloraLayout'
import { FreshCutLayout } from './FreshCutLayout'
import { FLORIST_LAYOUTS } from './florist/layouts'
import { FLORIST_KEYS } from './florist/registry'

export type { StorefrontLayoutProps } from './types'

/**
 * One layout per storefront theme. app/(public)/page.tsx resolves
 * `STOREFRONT_LAYOUTS[settings.theme]` and renders it with the tenant bundle.
 * Every theme has an entry (parseTheme guarantees a valid key), so the lookup is
 * total — no runtime fallback needed.
 */
export const STOREFRONT_LAYOUTS = {
  salvia: SalviaLayout,
  leander: LeanderLayout,
  zigge: ZiggeLayout,
  linnea: LinneaLayout,
  edit: EditLayout,
  flora: FloraLayout,
  freshcut: FreshCutLayout,
  ...FLORIST_LAYOUTS,
} as Record<StorefrontTheme, ComponentType<StorefrontLayoutProps>>

/**
 * Teman som ÄGER sina moduler: de väver in butik/blogg/presentkort/offert i sitt
 * EGET formspråk (via `modules`-propen) istället för att få den generiska
 * StorefrontModuleSections-stapeln under sig. Ersätter de två OR-kedjorna i
 * app/(public)/page.tsx — de var listor utan typkontroll, och en glömd nyckel gav
 * BÅDE modul-lösa hem OCH dubbelrenderade sektioner (tyst, aldrig ett byggfel).
 * Alla florist-mallar äger sina moduler per konstruktion (deras kontrakt kräver det).
 */
export const THEME_OWNS_MODULES: ReadonlySet<StorefrontTheme> = new Set<StorefrontTheme>([
  'flora', 'salvia', 'leander', 'zigge', 'linnea', 'edit',
  ...(FLORIST_KEYS as StorefrontTheme[]),
])
