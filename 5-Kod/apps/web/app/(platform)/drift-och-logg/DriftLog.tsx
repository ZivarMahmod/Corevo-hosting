'use client'

import { useMemo, useState } from 'react'
import { Card, Icon, PageHead, Button } from '@/components/portal/ui'
import type { PlatformAuditEntry, AuditActor } from '@/lib/platform/audit'
import styles from './drift.module.css'
import type { IconName } from '@/lib/ui-icons'
import {
  PLATFORM_AUDIT_TONE_COLORS,
  platformAuditActionLabel,
} from '@/lib/platform/audit-labels'

// Drift & logg — cross-tenant audit feed island (LAW: SuperPlatform.jsx → SuperOps).
// The server page gates (requirePlatformAdmin) and reads ONE unfiltered batch; this
// client component filters q + actor IN MEMORY exactly like the mock (rows already
// carry their classified actor/tone from the foundation read) and exports the
// currently-filtered set as CSV. Read-only — never mutates the append-only log.

const ACTORS: (AuditActor | 'Alla')[] = ['Alla', 'Zivar', 'System', 'Kund']

const ACTION_ICONS: Record<string, IconName> = {
  'tenant.create': 'plus',
  'tenant.suspend': 'pause',
  'tenant.activate': 'checkCircle',
  'tenant.delete': 'trash',
  'tenant.branding': 'palette',
  'tenant.billing': 'dollar',
  'tenant.invite': 'mail',
  'tenant.update': 'edit',
  'tenant.password_reset': 'mail',
  'tenant.staff_create': 'user',
}

/** Row icon for the tone-tile. Tenant keys map directly; booking → calendar/clock. */
function actionIcon(action: string): IconName {
  if (ACTION_ICONS[action]) return ACTION_ICONS[action]
  if (action.startsWith('booking.')) return 'calendar'
  return 'info'
}

/** Target line under the label: tenant name + the entity it touched (no meta). */
function targetLine(e: PlatformAuditEntry): string {
  const tenant = e.tenant && e.tenant !== '—' ? e.tenant : 'okänd kund'
  const entity = e.entity ? `${e.entity} · ` : ''
  return `${entity}${tenant}`
}

const fmtTime = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Stockholm',
})

function downloadCsv(rows: PlatformAuditEntry[]) {
  const header = ['Tid', 'Åtgärd', 'Mål', 'Aktör', 'Ton']
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  const lines = rows.map((r) =>
    [fmtTime.format(new Date(r.at)), platformAuditActionLabel(r.action), targetLine(r), r.actor, r.tone]
      .map(esc)
      .join(','),
  )
  const csv = '﻿' + [header.map(esc).join(','), ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `drift-logg-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function DriftLog({ entries }: { entries: PlatformAuditEntry[] }) {
  const [q, setQ] = useState('')
  const [actor, setActor] = useState<(typeof ACTORS)[number]>('Alla')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return entries.filter((e) => {
      if (actor !== 'Alla' && e.actor !== actor) return false
      if (!needle) return true
      const hay = `${platformAuditActionLabel(e.action)} ${targetLine(e)} ${e.action}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [entries, q, actor])

  return (
    <>
      {/* Export lives in the PageHead actions slot (mock: SuperOps PageHead →
          ghost "Exportera logg"); wired client-side to the currently-filtered set
          so it is honest, not a dead control. */}
      <PageHead
        eyebrow="Plattform"
        title="Drift & logg"
        lede="Vem gjorde vad, och när. Din svarta låda — tvärs över alla kunder via platform_admin."
      >
        <Button
          variant="ghost"
          icon="upload"
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
        >
          Exportera logg
        </Button>
      </PageHead>

      {/* filter row — search + actor pills (mock: in-memory, instant) */}
      <div className={styles.controls}>
        <div className={styles.search}>
          <span className={styles.searchIcon}>
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök i loggen…"
            aria-label="Sök i loggen"
          />
        </div>
        <div className={styles.actorPills} role="group" aria-label="Filtrera på aktör">
          {ACTORS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActor(f)}
              className={`${styles.pill} ${actor === f ? styles.pillOn : ''}`}
              aria-pressed={actor === f}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <Card pad={0}>
        <div className={styles.cardHead}>
          <h2 className="h2">Audit-logg</h2>
          <span className={`num ${styles.chip}`}>
            <Icon name="layers" size={12} />
            audit_log · append-only
          </span>
        </div>

        <div className={styles.rows}>
          {filtered.map((e, i) => (
            <div key={e.id} className={styles.row} style={i ? undefined : { borderTop: 'none' }}>
              <span className={styles.tile} style={{ color: PLATFORM_AUDIT_TONE_COLORS[e.tone] }}>
                <Icon name={actionIcon(e.action)} size={17} />
              </span>
              <div className={styles.rowBody}>
                <div className={styles.rowAction}>{platformAuditActionLabel(e.action)}</div>
                <div className={styles.rowTarget}>{targetLine(e)}</div>
              </div>
              <span className={styles.actor}>{e.actor}</span>
              <span className={`num ${styles.time}`}>{fmtTime.format(new Date(e.at))}</span>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className={styles.empty}>
              {entries.length === 0
                ? 'Ingen aktivitet loggad ännu. Operativa åtgärder (skapa kund, suspendera, lösenordsreset) och systemhändelser dyker upp här.'
                : 'Inget matchar.'}
            </div>
          )}
        </div>
      </Card>
    </>
  )
}
