'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { Icon } from '@/components/portal/ui'
import styles from './tenant-detail.module.css'
import {
  resolveTenantTabKey,
  tenantTabHref,
  type TenantTabKey,
} from './TenantDetailTabs.tabs'
import type { IconName } from '@/lib/ui-icons'

/**
 * Kund-detalj SubTabs — pill rail (icon + label, active pill forest-filled).
 *
 * Children-as-props, NOT a client page: the server `page.tsx` does every read
 * (RLS-bypass, server-only) and renders each tab's content — INCLUDING the existing
 * `'use client'` forms (BillingForm, StatusControl,
 * OperativeControls …) — to ReactNode, then hands those nodes here. This component
 * only toggles which is visible. So the page stays a server component, the reads
 * never round-trip through the client, and the existing form components work
 * unchanged.
 *
 * Core tabs (Översikt…Drift) are always present. MODULE tabs (Webshop/Blogg/
 * Offerter/Bildbibliotek, goal-54 §1) are optional: page.tsx includes them in
 * `tabs` only when the tenant's module is live — same gating as the
 * customer's own admin nav. The rail renders exactly the keys it was handed.
 */

// Logiska flikar — en entitet/område per flik. Modul-flikarnas ikoner speglar
// kund-adminens navigation så samma verktyg känns igen på båda ytorna.
const TABS: { key: TenantTabKey; icon: IconName }[] = [
  { key: 'Översikt', icon: 'grid' },
  { key: 'Tjänster', icon: 'star' },
  { key: 'Kunder', icon: 'users' },
  { key: 'Personal', icon: 'scissors' },
  { key: 'Kurser', icon: 'calendar' },
  { key: 'Klubben', icon: 'star' },
  { key: 'Webshop', icon: 'grid' },
  { key: 'Blogg', icon: 'edit' },
  { key: 'Offerter', icon: 'mail' },
  // goal-64: kontaktformulärets inkorg. Alltid synlig — /kontakt är ingen modul.
  { key: 'Meddelanden', icon: 'mail' },
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const available = TABS.filter((tab) => tab.key in tabs).map((tab) => tab.key)
  const active = resolveTenantTabKey(available, searchParams.get('kundflik'))

  return (
    <div className={active === 'Sida' ? styles.editorTabs : undefined}>
      <div className={styles.subtabs} role="tablist" aria-label="Kund-detalj">
        {TABS.filter((t) => t.key in tabs).map((t) => {
          const isActive = active === t.key
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={isActive}
              className={`${styles.subtab}${isActive ? ` ${styles.subtabActive}` : ''}`}
              href={tenantTabHref(pathname, t.key, searchParams.toString())}
            >
              <Icon name={t.icon} size={15} />
              {t.key}
            </Link>
          )
        })}
      </div>
      <div className={styles.tabPanel} role="tabpanel">{tabs[active]}</div>
    </div>
  )
}
