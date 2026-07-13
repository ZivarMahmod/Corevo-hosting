'use client'

import { useMemo, useState } from 'react'
import { Card, Icon, PageHead, Button, type IconName } from '@/components/portal/ui'
import type { PlatformAuditEntry, AuditActor, AuditTone } from '@/lib/platform/audit'
import styles from './drift.module.css'

// Drift & logg — cross-tenant audit feed island (LAW: SuperPlatform.jsx → SuperOps).
// The server page gates (requirePlatformAdmin) and reads ONE unfiltered batch; this
// client component filters q + actor IN MEMORY exactly like the mock (rows already
// carry their classified actor/tone from the foundation read) and exports the
// currently-filtered set as CSV. Read-only — never mutates the log
// (build-once-never-delete), so no toast/consequence band here.

const ACTORS: (AuditActor | 'Alla')[] = ['Alla', 'Zivar', 'System', 'Kund']

// tone → swatch colour for the row icon-tile + empty accents. Mirrors the
// mock's SP_AUDIT_TONE (var(--c-*) muted status tokens), kept in this island.
const TONE_COLOR: Record<AuditTone, string> = {
  info: 'var(--c-info)',
  success: 'var(--c-success)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-danger)',
  neutral: 'var(--c-ink-3)',
}

// audit_log stores dotted action keys; the read deliberately leaves them raw so the
// VIEW owns the action vocabulary (humanized label + icon). meta is not surfaced by
// the frozen read, so the label is derived from the key alone — the status suffix
// (booking.status.<x>) carries the state, no meta needed.
const BOOKING_STATUS_SV: Record<string, string> = {
  pending: 'avvaktar',
  confirmed: 'bekräftad',
  completed: 'genomförd',
  cancelled: 'avbokad',
  no_show: 'utebliven',
}

const ACTION_LABELS: Record<string, string> = {
  'tenant.create': 'Kund skapad (atomiskt)',
  'tenant.suspend': 'Kund suspenderad',
  'tenant.activate': 'Kund återaktiverad',
  'tenant.delete': 'Kund raderad (mjuk)',
  'tenant.branding': 'Varumärke uppdaterat',
  'tenant.billing': 'Prismodell ändrad',
  'tenant.invite': 'Personal inbjuden (magic-link)',
  'tenant.update': 'Kunddata redigerad',
  'tenant.password_reset': 'Lösenordsreset skickad',
  'tenant.staff_create': 'Personal tillagd',
}

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

/** Humanized action label from the raw dotted key (no meta available). */
function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  if (action.startsWith('booking.status.')) {
    const status = action.slice('booking.status.'.length)
    return `Bokning ${BOOKING_STATUS_SV[status] ?? status}`
  }
  if (action.startsWith('booking.')) return 'Bokningshändelse'
  // Honest fallback: show the raw key rather than invent a label.
  return action
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
    [fmtTime.format(new Date(r.at)), actionLabel(r.action), targetLine(r), r.actor, r.tone]
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
      const hay = `${actionLabel(e.action)} ${targetLine(e)} ${e.action}`.toLowerCase()
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
            audit_log · build-once-never-delete
          </span>
        </div>

        <div className={styles.rows}>
          {filtered.map((e, i) => (
            <div key={e.id} className={styles.row} style={i ? undefined : { borderTop: 'none' }}>
              <span className={styles.tile} style={{ color: TONE_COLOR[e.tone] }}>
                <Icon name={actionIcon(e.action)} size={17} />
              </span>
              <div className={styles.rowBody}>
                <div className={styles.rowAction}>{actionLabel(e.action)}</div>
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
