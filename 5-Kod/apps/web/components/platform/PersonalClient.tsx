'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Badge,
  Button,
  Card,
  Drawer,
  Icon,
  PageHead,
  Stat,
  Table,
  useToast,
  type BadgeTone,
} from '@/components/portal/ui'
import { createTenantStaff, type ActionState } from '@/lib/platform/actions'
import type { StaffListItem } from '@/lib/platform/people'
import styles from './personal-platform.module.css'

/** Salong option for the invite-drawer dropdown (any salon can be the target). */
export type TenantOption = { id: string; name: string }

/** Three invite-statuses the mock surfaces (people.ts staffStatus derives these). */
const STATUS_FILTERS = ['Alla', 'Aktiv', 'Inbjuden', 'Väntar bekräftelse'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

/** status → muted badge tone (mock stTone: Aktiv→success, Inbjuden→info, else warning). */
function statusTone(status: string): BadgeTone {
  if (status === 'Aktiv') return 'success'
  if (status === 'Inbjuden') return 'info'
  return 'warning'
}

/** ISO created_at → "12 jan 2024". Honest em-dash when absent. */
function invitedLabel(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/**
 * Personal (cross-tenant) interaction island — SuperData.jsx:SuperStaff. PageHead
 * (with the "Lägg till personal" button in its actions slot), an honest derived stat
 * grid, a search + status-pill control row (live counts), the cross-tenant staff
 * table, and the "Lägg till personal" Drawer.
 *
 * NO row-detail drawer + a non-clickable name cell — SuperStaff has neither (the
 * mock's only Drawer is the add one; its name cell is a plain <span>). The Kunder
 * view (SuperCustomers) has the detail drawer; Personal does not.
 *
 * HONEST DATA (#2/#3 ärlighetspass): every figure is derived from the real `staff`
 * rows (the mock's `+32`/`+30`/`"24"` placeholder math is NOT carried). The drawer
 * runs the REAL createTenantStaff action (inserts a staff row on the chosen tenant —
 * namn + salong, the only fields it stores). No email/roll inputs (they are NOT
 * persisted by this action — never render fields that look saved), no "magic-link"
 * claim (no e-post is sent), no per-row "Påminn" (no reminder action exists).
 */
export function PersonalClient({
  staff,
  tenants,
}: {
  staff: StaffListItem[]
  tenants: TenantOption[]
}) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('Alla')
  const [inviting, setInviting] = useState(false)

  // Honest aggregates over the REAL rows (never the mock's fabricated offsets).
  const stats = useMemo(() => {
    const aktiva = staff.filter((s) => s.status === 'Aktiv').length
    const salonger = new Set(staff.map((s) => s.slug || s.tenant)).size
    return {
      total: staff.length,
      aktiva,
      vantar: staff.length - aktiva,
      salonger,
    }
  }, [staff])

  const counts = useMemo<Record<StatusFilter, number>>(
    () => ({
      Alla: staff.length,
      Aktiv: staff.filter((s) => s.status === 'Aktiv').length,
      Inbjuden: staff.filter((s) => s.status === 'Inbjuden').length,
      'Väntar bekräftelse': staff.filter((s) => s.status === 'Väntar bekräftelse').length,
    }),
    [staff],
  )

  const term = q.trim().toLowerCase()
  const list = useMemo(
    () =>
      staff.filter(
        (s) =>
          (status === 'Alla' || s.status === status) &&
          (term === '' ||
            `${s.name} ${s.email ?? ''} ${s.tenant}`.toLowerCase().includes(term)),
      ),
    [staff, status, term],
  )

  return (
    <>
      <PageHead
        eyebrow="Data & drift"
        title="Personal"
        lede="Lägg till frisörer åt salonger som vill ha hjälp. Skapar en personalrad direkt på vald salong."
      >
        <Button variant="primary" icon="plus" onClick={() => setInviting(true)}>
          Lägg till personal
        </Button>
      </PageHead>

      <div className="bo-stat-grid" style={{ marginBottom: 18 }}>
        <Stat label="Personal totalt" value={stats.total} icon="scissors" />
        <Stat label="Aktiva" value={stats.aktiva} icon="checkCircle" />
        <Stat
          label="Ej aktiva"
          value={stats.vantar}
          deltaTone="muted"
          icon="mail"
        />
        <Stat label="Salonger" value={stats.salonger} icon="building" />
      </div>

      {/* search + status-pills (mock control row — search + pills only) */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          margin: '16px 0',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--c-ink-3)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök personal, salong…"
            aria-label="Sök personal"
            className={styles.search}
          />
        </div>
        {STATUS_FILTERS.map((f) => {
          const active = status === f
          return (
            <button
              key={f}
              type="button"
              onClick={() => setStatus(f)}
              aria-pressed={active}
              className={styles.pill}
              data-active={active ? '' : undefined}
            >
              {f}
              <span className="num" style={{ fontSize: 11, opacity: 0.7 }}>
                {counts[f]}
              </span>
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <EmptyState filtered={term !== '' || status !== 'Alla'} />
      ) : (
        <Card pad={0}>
          <Table
            cols={['Namn', 'Salong', 'Roll', 'Tjänster', 'Inbjuden', 'Status', '']}
            rows={list.map((s) => [
              <span key={`${s.id}-name`} className={styles.nameCell}>
                <span className={styles.avatar} aria-hidden="true">
                  {s.name.charAt(0).toUpperCase() || '·'}
                </span>
                <span>
                  <b style={{ fontWeight: 600 }}>{s.name}</b>
                  <span className={styles.sub}>{s.email ?? 'Ingen e-post'}</span>
                </span>
              </span>,
              s.tenant,
              s.role,
              <span key={`${s.id}-svc`} className="num">
                {s.services} st
              </span>,
              <span key={`${s.id}-inv`} style={{ fontSize: 12.5, color: 'var(--c-ink-2)' }}>
                {invitedLabel(s.invited)}
              </span>,
              <Badge key={`${s.id}-st`} tone={statusTone(s.status)} dot={false}>
                {s.status}
              </Badge>,
              s.status === 'Aktiv' ? (
                <Icon
                  key={`${s.id}-act`}
                  name="check"
                  size={16}
                  style={{ color: 'var(--c-success)' }}
                />
              ) : (
                <span key={`${s.id}-act`} style={{ color: 'var(--c-ink-3)' }}>
                  —
                </span>
              ),
            ])}
          />
        </Card>
      )}

      {inviting && <InviteDrawer tenants={tenants} onClose={() => setInviting(false)} />}
    </>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className={styles.empty}>
      {filtered ? (
        <>
          <p className={styles.emptyTitle}>Inget matchar</p>
          <p className={styles.emptyText}>
            Ingen personal matchar sökningen eller statusfiltret. Prova en bredare
            sökning eller välj <b>Alla</b>.
          </p>
        </>
      ) : (
        <>
          <p className={styles.emptyTitle}>Ingen personal ännu</p>
          <p className={styles.emptyText}>
            När en salong onboardar frisörer dyker de upp här — tvärs alla salonger.
            Lägg till den första med <b>Lägg till personal</b>.
          </p>
        </>
      )}
    </div>
  )
}

/** "Lägg till personal" — wired to the REAL createTenantStaff action: it inserts a
 *  staff row (namn + salong) on the chosen tenant. Only those two fields are stored,
 *  so only those two are shown — no email/roll inputs that look saved but aren't, and
 *  no "magic-link" claim (no e-post is sent). */
function InviteDrawer({
  tenants,
  onClose,
}: {
  tenants: TenantOption[]
  onClose: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTenantStaff, {})

  useEffect(() => {
    if (state.success) {
      notify('Personal tillagd', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <Drawer
      title="Lägg till personal"
      sub="Skapar en personalrad direkt på vald salong."
      ariaLabel="Lägg till personal"
      onClose={onClose}
    >
      <form action={formAction} style={{ display: 'grid', gap: 14 }}>
        <label className={styles.field}>
          <span>Namn</span>
          <input name="title" required placeholder="t.ex. Hilal — frisör" aria-label="Namn / titel" />
        </label>
        <label className={styles.field}>
          <span>Salong</span>
          <select name="tenantId" defaultValue={tenants[0]?.id ?? ''} required>
            {tenants.length === 0 ? (
              <option value="">Ingen salong ännu</option>
            ) : (
              tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))
            )}
          </select>
        </label>
        {state.error && (
          <p className="auth-error" role="alert" style={{ margin: 0, fontSize: 12.5 }}>
            {state.error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <Button
            variant="ghost"
            onClick={onClose}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Avbryt
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon="plus"
            disabled={pending || tenants.length === 0}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {pending ? 'Lägger till…' : 'Lägg till'}
          </Button>
        </div>
      </form>
    </Drawer>
  )
}
