'use client'

import { Badge, type BadgeTone, Button, useToast } from '@/components/portal/ui'
import type { IntegrationStatus, IntegrationWithCount } from '@/lib/platform/catalog'
import styles from './IntegrationsGrid.module.css'

/**
 * Integrationer card grid (goal-17 PLATFORM). EXACT copy of the design-system law
 * source composition (components/SuperPlatform.jsx → SuperIntegrations): a card per
 * integration with letter-avatar + name + tenants-line + status Badge, then desc /
 * flow-chip / Hantera+Docs.
 *
 * Client component because the "Hantera" button fires a consequence-toast (§6) via
 * useToast — a client hook. The server page does the `getPlatformIntegrations()`
 * read (server-only, RLS-bypass) and hands the fully-serializable array down here.
 *
 * HONEST COUNTS (NEVER FAKE DATA): the tenants-line shows the LIVE
 * "{connected} / {total} anslutna" ONLY where a backing column exists
 * (connected !== null — Stripe/Google/Domän). Where no per-tenant column backs the
 * integration (SMS/E-post/POS → connected === null) we render an honest neutral
 * label instead of the mock's fabricated "21 / 24". The mock's hardcoded strings are
 * placeholders, not truth.
 */

// Mock SuperIntegrations `tone()` ternary — status → muted Badge tone.
const STATUS_TONE: Record<IntegrationStatus, BadgeTone> = {
  Aktiv: 'success',
  Pilot: 'info',
  Delvis: 'warning',
  Inaktiv: 'neutral',
}

/** The honest tenants-line: live count where backed, neutral label otherwise. */
function tenantsLine(it: IntegrationWithCount) {
  if (it.connected === null) {
    // No per-tenant backing column — never fabricate a count.
    return <span className={styles.tenants}>Plattformsbred · ingen per-salong-status</span>
  }
  return (
    <span className={styles.tenants}>
      <span className="num">
        {it.connected} / {it.total}
      </span>{' '}
      anslutna
    </span>
  )
}

export function IntegrationsGrid({ integrations }: { integrations: IntegrationWithCount[] }) {
  const { notify } = useToast()

  return (
    <div className={styles.grid}>
      {integrations.map((it) => (
        <div key={it.id} className={styles.card}>
          <div className={styles.head}>
            <div className={styles.ident}>
              <div className={styles.avatar} style={{ background: it.color }} aria-hidden="true">
                {it.letter}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className={styles.name}>{it.name}</div>
                {tenantsLine(it)}
              </div>
            </div>
            <Badge tone={STATUS_TONE[it.status] ?? 'neutral'}>{it.status}</Badge>
          </div>

          <p className={styles.desc}>{it.desc}</p>

          <div className={styles.flow}>
            <span className={styles.chip} title={it.flow}>
              {it.flow}
            </span>
          </div>

          <div className={styles.foot}>
            <Button
              variant="ghost"
              size="sm"
              icon="settings"
              className={styles.footPrimary}
              onClick={() => notify(`${it.name} — inställningar öppnade`, 'info')}
            >
              Hantera
            </Button>
            {/* Docs has no target in the law source — visual parity only. */}
            <Button variant="subtle" size="sm" icon="external">
              Docs
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
