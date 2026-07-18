'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Icon } from '@/components/portal/ui'
import { SETTINGS_GROUPS } from '@/lib/admin/settings-map'
import type {
  SettingsNavigationCategory,
  SettingsNavigationSearchEntry,
} from '@/lib/settings-navigation'
import { SettingsNavigation } from './SettingsV2'
import styles from './settings-v2.module.css'

export function SettingsWorkspace({
  categories,
  currentCategory,
  children,
  rootHref = '/admin/installningar',
  groups = SETTINGS_GROUPS,
  searchEntries,
  mobileIndex = false,
}: {
  categories: SettingsNavigationCategory[]
  currentCategory: string
  children: ReactNode
  rootHref?: string
  groups?: readonly string[]
  searchEntries?: SettingsNavigationSearchEntry[]
  mobileIndex?: boolean
}) {
  const router = useRouter()

  return (
    <section
      className={`${styles.root} ${mobileIndex ? '' : styles.workspace}`}
      aria-label="Inställningar"
      data-accept="settings-workspace"
    >
      <SettingsNavigation
        categories={categories}
        selectedId={currentCategory}
        onChoose={(category) => router.push(category.href)}
        className={mobileIndex ? undefined : styles.workspaceNav}
        groups={groups}
        searchEntries={searchEntries}
      />

      <div
        className={`${styles.paneWrap} ${mobileIndex ? styles.mobileHidden : ''}`}
        data-accept="settings-pane"
      >
        <div className={`${styles.pane} ${styles.workspacePane}`}>
          <Link className={`${styles.mobileBack} ${styles.workspaceBack}`} href={rootHref}>
            <Icon name="arrowLeft" size={15} /> Tillbaka till inställningar
          </Link>
          <div className={styles.workspaceContent}>{children}</div>
        </div>
      </div>
    </section>
  )
}
