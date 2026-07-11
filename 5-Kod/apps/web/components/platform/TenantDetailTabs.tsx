'use client'

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/portal/ui'
import styles from './tenant-detail.module.css'

/**
 * Kund-detalj SubTabs — pill rail (icon + label, active pill forest-filled).
 *
 * Children-as-props, NOT a client page: the server `page.tsx` does every read
 * (RLS-bypass, server-only) and renders each tab's content — INCLUDING the existing
 * `'use client'` forms (PlatformBrandingForm, BillingForm, StatusControl,
 * OperativeControls …) — to ReactNode, then hands those nodes here. This component
 * only toggles which is visible. So the page stays a server component, the reads
 * never round-trip through the client, and the existing form components work
 * unchanged.
 *
 * Core tabs (Översikt…Drift) are always present. MODULE tabs (Webshop/Blogg/
 * Offerter/Bildbibliotek, goal-54 §1) are optional: page.tsx includes them in
 * `tabs` ONLY when the tenant's module is on (live/paused) — same gating as the
 * customer's own admin nav. The rail renders exactly the keys it was handed.
 */

export type TenantTabKey =
  | 'Översikt'
  | 'Tjänster'
  | 'Kunder'
  | 'Personal'
  | 'Kurser'
  | 'Webshop'
  | 'Blogg'
  | 'Offerter'
  | 'Bildbibliotek'
  | 'Sida'
  | 'Integrationer'
  | 'Drift'

// Logiska flikar — en entitet/område per flik. Modul-flikarnas ikoner speglar
// kund-adminens nav (PortalSidebar) så samma verktyg känns igen på båda ytorna.
const TABS: { key: TenantTabKey; icon: IconName }[] = [
  { key: 'Översikt', icon: 'grid' },
  { key: 'Tjänster', icon: 'star' },
  { key: 'Kunder', icon: 'users' },
  { key: 'Personal', icon: 'scissors' },
  { key: 'Kurser', icon: 'calendar' },
  { key: 'Webshop', icon: 'grid' },
  { key: 'Blogg', icon: 'edit' },
  { key: 'Offerter', icon: 'mail' },
  { key: 'Bildbibliotek', icon: 'upload' },
  { key: 'Sida', icon: 'palette' },
  { key: 'Integrationer', icon: 'link' },
  { key: 'Drift', icon: 'shield' },
]

export function TenantDetailTabs({
  tabs,
}: {
  tabs: Partial<Record<TenantTabKey, ReactNode>>
}) {
  const [active, setActive] = useState<TenantTabKey>('Översikt')

  return (
    <div>
      <div className={styles.subtabs} role="tablist" aria-label="Kund-detalj">
        {TABS.filter((t) => t.key in tabs).map((t) => {
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
