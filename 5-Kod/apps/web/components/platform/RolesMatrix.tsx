'use client'

import { useMemo, useState, useTransition } from 'react'
import { Card, Badge, Table, Icon } from '@/components/portal/ui'
import { useToast } from '@/components/portal/ui'
import { Button } from '@/components/portal/ui'
import type { PlatformRoleWithUsers } from '@/lib/platform/catalog'
import { PERMISSION_AREAS, nextPerm, type Perm, type PermArea } from '@/lib/platform/catalog-shared'
import { saveRolePermissionsAction } from '@/lib/platform/actions'
import styles from './RolesMatrix.module.css'

/**
 * Roller & behörighet — role list + EDITABLE RBAC permission matrix (goal-21).
 * The grid is no longer a read-only reference: clicking a cell cycles its perm
 * (full→own→view→—→full); a dirty "Spara"-bar persists the diff via
 * saveRolePermissionsAction (platform_admin-gated, super_admin self-lockout guarded,
 * audit-logged server-side). The cells are honest controls — the server is the
 * truth (resolveRoleMatrix + canWrite enforce on real write surfaces), the matrix
 * can ONLY narrow a role, never grant access a level gate doesn't already allow.
 *
 * The super_admin row is LOCKED (rendered static with a lock affordance): it must
 * stay full on every area or is_platform_admin's bypass would lock Zivar out, so we
 * never offer a control that the save-guard would reject.
 *
 * The ONE live signal beyond the perms is `users` (real cross-tenant count per role
 * name); where no seeded DB role backs it (Support/Ekonomi → users === null) we
 * render an honest "—", NEVER a fabricated count.
 */

const PROTECTED_ROLE = 'super_admin'

// PermCell label — perm → display text. '—' renders muted.
const PERM_LABEL: Record<Exclude<Perm, '—'>, string> = {
  full: 'Full',
  own: 'Egen',
  view: 'Läs',
}

function permClass(v: Perm): string {
  return v === '—' ? styles.permNone ?? '' : `${styles.perm} ${styles[`perm_${v}`]}`
}

function PermText({ v }: { v: Perm }) {
  if (v === '—') return <span className={styles.permNone}>—</span>
  return <span className={`${styles.perm} ${styles[`perm_${v}`]}`}>{PERM_LABEL[v]}</span>
}

// TableChip — small backing-table/flow pill (mock TableChip: layers icon + info tint).
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
  const toast = useToast()
  const [pending, startTransition] = useTransition()

  // Editable working copy: roleName → perms[] (aligned to PERMISSION_AREAS). Seeded
  // from the server props; cell edits mutate this, never the props.
  const initial = useMemo<Record<string, Perm[]>>(
    () => Object.fromEntries(roles.map((r) => [r.roleName, [...r.perms]])),
    [roles],
  )
  const [draft, setDraft] = useState<Record<string, Perm[]>>(initial)

  const role = roles[sel] ?? roles[0]

  // Dirty diff (only the changed cells get persisted).
  const changes = useMemo(() => {
    const out: { roleName: string; area: PermArea; perm: Perm }[] = []
    for (const r of roles) {
      const cur = draft[r.roleName] ?? r.perms
      PERMISSION_AREAS.forEach((area, i) => {
        if (cur[i] !== r.perms[i]) out.push({ roleName: r.roleName, area, perm: cur[i] ?? '—' })
      })
    }
    return out
  }, [draft, roles])
  const dirty = changes.length > 0

  if (!role) {
    return (
      <Card>
        <p className={styles.empty}>Inga roller definierade.</p>
      </Card>
    )
  }

  const activeRole = role
  const locked = activeRole.roleName === PROTECTED_ROLE
  const draftPerms = draft[activeRole.roleName] ?? activeRole.perms

  const cycleCell = (i: number) => {
    if (locked) return
    setDraft((prev) => {
      const cur = [...(prev[activeRole.roleName] ?? activeRole.perms)]
      cur[i] = nextPerm(cur[i] ?? '—')
      return { ...prev, [activeRole.roleName]: cur }
    })
  }

  const reset = () => {
    setDraft(initial)
  }

  const save = () => {
    startTransition(async () => {
      const res = await saveRolePermissionsAction(changes)
      if (res.error) {
        toast.notify(res.error, 'warning')
      } else {
        toast.notify(res.success ?? 'Behörigheter sparade.', 'success')
        // The revalidated server props will re-seed `initial` on the next render;
        // until then, treat the draft as the new baseline by clearing the diff.
        setDraft((d) => ({ ...d }))
      }
    })
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
              key={r.roleName}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={sel === i}
              className={`${styles.roleBtn} ${sel === i ? styles.roleBtnSel : ''}`}
            >
              <Badge tone={r.tone} dot={false}>
                {r.who}
              </Badge>
              <span className={styles.roleName}>{r.name}</span>
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
              locked ? (
                // super_admin is locked full — render static with a lock affordance,
                // never a fake control the save-guard would reject.
                <span key={area} className={styles.lockedCell} title="Super admin kan inte nedgraderas">
                  <PermText v={draftPerms[i] ?? '—'} />
                  <Icon name="shield" size={12} />
                </span>
              ) : (
                <button
                  key={area}
                  type="button"
                  className={`${styles.cellBtn} ${permClass(draftPerms[i] ?? '—')}`}
                  onClick={() => cycleCell(i)}
                  disabled={pending}
                  aria-label={`${role.name} · ${area}: ${draftPerms[i] === '—' ? 'ingen' : PERM_LABEL[draftPerms[i] as Exclude<Perm, '—'>]} — klicka för att ändra`}
                >
                  {draftPerms[i] === '—' ? '—' : PERM_LABEL[draftPerms[i] as Exclude<Perm, '—'>]}
                </button>
              ),
            ])}
          />
          <div className={styles.legend}>
            {(['full', 'own', 'view'] as const).map((k) => (
              <span key={k} className={styles.legendItem}>
                <PermText v={k} />{' '}
                {k === 'full' ? 'Full kontroll' : k === 'own' ? 'Egen tenant/data' : 'Endast läs'}
              </span>
            ))}
          </div>
        </Card>

        {/* Dirty save-bar — honest, only shown when there's an actual diff. */}
        {dirty ? (
          <div className={styles.saveBar} role="status">
            <span className={styles.saveHint}>
              {changes.length} {changes.length === 1 ? 'ändring' : 'ändringar'} att spara
            </span>
            <div className={styles.saveBtns}>
              <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
                Återställ
              </Button>
              <Button variant="gold" size="sm" icon="check" onClick={save} disabled={pending}>
                {pending ? 'Sparar…' : 'Spara'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
