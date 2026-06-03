'use client'

import { useState } from 'react'
import { Card, Badge, Table, Icon } from '@/components/portal/ui'
import type { PlatformRoleWithUsers } from '@/lib/platform/catalog'
import { PERMISSION_AREAS, type Perm } from '@/lib/platform/catalog-shared'
import styles from './RolesMatrix.module.css'

/**
 * Roller & behörighet — role list + RBAC permission matrix (goal-17 PLATFORM).
 * EXACT copy of the design-system law source composition
 * (components/SuperPlatform.jsx → SuperRoles + PermCell): a 2-col layout, the left
 * card a clickable role list, the right a role-detail Card + a Behörighetsmatris
 * table whose cells are tone-coloured Perm pills, with a legend footer.
 *
 * Client component because the role list is interactive (clicking a role re-renders
 * the matrix) — the mock's instant `useState(sel)`. The server page does the
 * `getPlatformRoles()` read (server-only, RLS-bypass) and hands the
 * fully-serializable roles array (with LIVE cross-tenant user counts) down here.
 *
 * READ-ONLY reference matrix: the permission grid is platform CONFIGURATION (static
 * least-privilege design), NOT a live RBAC editor — there are no controls that
 * mutate roles. The only live signal is `users` (real cross-tenant count per role
 * name); where no seeded DB role backs it (Support/Ekonomi → users === null) we
 * render an honest "—", NEVER a fabricated count (the mock's 24/38/2/1 are
 * placeholders).
 */

// PermCell — mock `PermCell` map: perm → [tone-class, label]. '—' renders muted.
const PERM_LABEL: Record<Exclude<Perm, '—'>, string> = {
  full: 'Full',
  own: 'Egen',
  view: 'Läs',
}

function PermCell({ v }: { v: Perm }) {
  if (v === '—') return <span className={styles.permNone}>—</span>
  return <span className={`${styles.perm} ${styles[`perm_${v}`]}`}>{PERM_LABEL[v]}</span>
}

// TableChip — small backing-table/flow pill (mock TableChip: layers icon + info
// tint). Exact-copied here because it is not an exported ui/ primitive.
function TableChip({ children }: { children: React.ReactNode }) {
  return (
    <span className={`num ${styles.chip}`}>
      <Icon name="layers" size={12} />
      {children}
    </span>
  )
}

export function RolesMatrix({ roles }: { roles: PlatformRoleWithUsers[] }) {
  const [sel, setSel] = useState(0)
  const role = roles[sel] ?? roles[0]

  if (!role) {
    // No role catalog at all — honest empty-state (defensive; catalog is static).
    return (
      <Card>
        <p className={styles.empty}>Inga roller definierade.</p>
      </Card>
    )
  }

  return (
    <div className={styles.grid}>
      {/* Left — role list */}
      <Card pad={0}>
        <div className={styles.cardHead}>
          <h2 className="h2">Roller</h2>
        </div>
        <div className={styles.roleList}>
          {roles.map((r, i) => (
            <button
              key={r.name}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={sel === i}
              className={`${styles.roleBtn} ${sel === i ? styles.roleBtnSel : ''}`}
            >
              <Badge tone={r.tone} dot={false}>
                {r.who}
              </Badge>
              <span className={styles.roleName}>{r.name}</span>
              {/* Live cross-tenant count — honest "—" when no seeded DB role. */}
              {r.users === null ? (
                <span className={styles.roleUsersMuted} title="Ingen seedad roll — ingen källa">
                  —
                </span>
              ) : (
                <span className={`num ${styles.roleUsers}`}>{r.users}</span>
              )}
            </button>
          ))}
        </div>
      </Card>

      {/* Right — selected role detail + matrix */}
      <div className={styles.detail}>
        <Card>
          <div className={styles.roleTitle}>
            <Badge tone={role.tone} dot={false}>
              {role.who}
            </Badge>
            <h2 className="h2">{role.name}</h2>
          </div>
          <p className={styles.note}>{role.note}</p>
        </Card>

        <Card pad={0}>
          <div className={styles.cardHead}>
            <h2 className="h2">Behörighetsmatris</h2>
            <TableChip>RLS · private.tenant_id()</TableChip>
          </div>
          <Table
            cols={['Område', 'Åtkomst']}
            rows={PERMISSION_AREAS.map((area, i) => [
              area,
              <PermCell key={area} v={role.perms[i] ?? '—'} />,
            ])}
          />
          <div className={styles.legend}>
            {(['full', 'own', 'view'] as const).map((k) => (
              <span key={k} className={styles.legendItem}>
                <PermCell v={k} />{' '}
                {k === 'full' ? 'Full kontroll' : k === 'own' ? 'Egen tenant/data' : 'Endast läs'}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
