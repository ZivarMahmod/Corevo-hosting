'use client'

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/portal/ui'
import styles from './tenant-detail.module.css'

/**
 * Salong-detalj SubTabs (law: SuperTenant.jsx — six under-flikar Översikt/Data/
 * Personal/Branding/Integrationer/Drift). EXACT copy of the mock's SubTabs
 * composition: a pill rail where each tab is icon + label, the active pill forest-
 * filled.
 *
 * Children-as-props, NOT a client page: the server `page.tsx` does every read
 * (RLS-bypass, server-only) and renders each tab's content — INCLUDING the existing
 * `'use client'` forms (PlatformBrandingForm, BillingForm, StatusControl,
 * OperativeControls …) — to ReactNode, then hands those nodes here. This component
 * only toggles which is visible. So the page stays a server component, the reads
 * never round-trip through the client, and the existing form components work
 * unchanged.
 */

export type TenantTabKey =
  | 'Översikt'
  | 'Data'
  | 'Personal'
  | 'Branding'
  | 'Integrationer'
  | 'Drift'

const TABS: { key: TenantTabKey; icon: IconName }[] = [
  { key: 'Översikt', icon: 'grid' },
  { key: 'Data', icon: 'layers' },
  { key: 'Personal', icon: 'scissors' },
  { key: 'Branding', icon: 'palette' },
  { key: 'Integrationer', icon: 'link' },
  { key: 'Drift', icon: 'shield' },
]

export function TenantDetailTabs({
  tabs,
}: {
  tabs: Record<TenantTabKey, ReactNode>
}) {
  const [active, setActive] = useState<TenantTabKey>('Översikt')

  return (
    <div>
      <div className={styles.subtabs} role="tablist" aria-label="Salong-detalj">
        {TABS.map((t) => {
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.subtab}${isActive ? ` ${styles.subtabActive}` : ''}`}
              onClick={() => setActive(t.key)}
            >
              <Icon name={t.icon} size={15} />
              {t.key}
            </button>
          )
        })}
      </div>
      <div role="tabpanel">{tabs[active]}</div>
    </div>
  )
}
