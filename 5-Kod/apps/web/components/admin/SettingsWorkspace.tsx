'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Icon } from '@/components/portal/ui'
import type { SettingsCategory, SettingsCategoryId } from '@/lib/admin/settings-map'
import { SettingsNavigation } from './SettingsV2'
import styles from './settings-v2.module.css'

export function SettingsWorkspace({
  categories,
  currentCategory,
  children,
}: {
  categories: SettingsCategory[]
  currentCategory: SettingsCategoryId
  children: ReactNode
}) {
  const router = useRouter()

  return (
    <section
      className={`${styles.root} ${styles.workspace}`}
      aria-label="Inställningar"
      data-accept="settings-workspace"
    >
      <SettingsNavigation
        categories={categories}
        selectedId={currentCategory}
        onChoose={(category) => router.push(category.href)}
        className={styles.workspaceNav}
      />

      <div className={styles.paneWrap} data-accept="settings-pane">
        <div className={`${styles.pane} ${styles.workspacePane}`}>
          <Link className={`${styles.mobileBack} ${styles.workspaceBack}`} href="/admin/installningar">
            <Icon name="arrowLeft" size={15} /> Tillbaka till inställningar
          </Link>
          <div className={styles.workspaceContent}>{children}</div>
        </div>
      </div>
    </section>
  )
}
