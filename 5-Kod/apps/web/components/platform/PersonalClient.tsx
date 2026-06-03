'use client'

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Callout,
  Card,
  Drawer,
  Icon,
  PageHead,
  Stat,
  Table,
  useToast,
  type BadgeTone,
} from '@/components/portal/ui'
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
 * Personal (cross-tenant) interaction island — SuperData.jsx:SuperStaff. Exact
 * copy of the law source's composition: PageHead (with the "Bjud in personal"
 * button in its actions slot), an honest derived stat grid, the SERVICE_ROLE_KEY
 * guard-band, a search + status-pill control row (live counts), the cross-tenant
 * staff table with a per-row "Påminn" nudge, and the "Bjud in personal" Drawer.
 *
 * NO row-detail drawer + a non-clickable name cell — SuperStaff has neither (the
 * mock's only Drawer is the invite one; its name cell is a plain <span>). The
 * Kunder view (SuperCustomers) has the detail drawer; Personal does not.
 *
 * HONEST DATA: every figure is derived from the real `staff` rows (the mock's
 * `+32`/`+30`/`"24"` placeholder math is NOT carried). Mutations are toast-only —
 * the real magic-link invite + "Påminn" need SUPABASE_SERVICE_ROLE_KEY and a new
 * lib/platform action (frozen — flagged), and the mock itself is toast-only here.
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
        lede="Onboarda frisörer åt salonger som vill ha hjälp. Magic-link-invite — rätt roll tilldelas direkt."
      >
        <Button variant="primary" icon="mail" onClick={() => setInviting(true)}>
          Bjud in personal
        </Button>
      </PageHead>

      <div className="bo-stat-grid" style={{ marginBottom: 18 }}>
        <Stat label="Personal totalt" value={stats.total} icon="scissors" />
        <Stat label="Aktiva" value={stats.aktiva} icon="checkCircle" />
        <Stat
          label="Väntar invite"
          value={stats.vantar}
          deltaTone="muted"
          icon="mail"
          hint="magic-link"
        />
        <Stat label="Salonger" value={stats.salonger} icon="building" />
      </div>

      {/* SERVICE_ROLE_KEY guard-band (mock warning-bg band, §4.7) */}
      <Callout tone="warning" icon="alert">
        Invite-vägen kräver{' '}
        <span className="num" style={{ fontWeight: 600 }}>
          SERVICE_ROLE_KEY
        </span>{' '}
        som Worker-secret — kod-klar men overifierad. Verifiera i bygget.
      </Callout>

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
              s.status !== 'Aktiv' ? (
                <RemindButton key={`${s.id}-act`} staff={s} />
              ) : (
                <Icon
                  key={`${s.id}-act`}
                  name="check"
                  size={16}
                  style={{ color: 'var(--c-success)' }}
                />
              ),
            ])}
          />
        </Card>
      )}

      {inviting && <InviteDrawer tenants={tenants} onClose={() => setInviting(false)} />}
    </>
  )
}

/** Per-row nudge for a pending invite — toast-only (mirrors the mock; real remind
 *  needs SERVICE_ROLE_KEY + a frozen lib/platform action, flagged in the manifest). */
function RemindButton({ staff }: { staff: StaffListItem }) {
  const { notify } = useToast()
  return (
    <button
      type="button"
      className={styles.remind}
      onClick={() => notify(`Påminnelse skickad till ${staff.email ?? staff.name}`, 'info')}
    >
      Påminn
    </button>
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
            Bjud in den första med <b>Bjud in personal</b>.
          </p>
        </>
      )}
    </div>
  )
}

/** "Bjud in personal" — engångs-invite via magic-link. Toast-only here: the real
 *  send needs SERVICE_ROLE_KEY + a frozen lib/platform action (flagged). */
function InviteDrawer({
  tenants,
  onClose,
}: {
  tenants: TenantOption[]
  onClose: () => void
}) {
  const { notify } = useToast()
  return (
    <Drawer
      title="Bjud in personal"
      sub="Engångs-invite. Frisören sätter eget lösenord."
      ariaLabel="Bjud in personal"
      onClose={onClose}
      footer={
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
            icon="mail"
            onClick={() => {
              onClose()
              notify('Invite skickad — magic-link på väg', 'info')
            }}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Skicka invite
          </Button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <label className={styles.field}>
          <span>E-post</span>
          <input type="email" placeholder="frisor@salong.se" autoCapitalize="none" />
        </label>
        <label className={styles.field}>
          <span>Namn</span>
          <input placeholder="Valfritt — frisören kan fylla i själv" />
        </label>
        <label className={styles.field}>
          <span>Salong</span>
          <select defaultValue={tenants[0]?.id ?? ''}>
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
        <label className={styles.field}>
          <span>Roll</span>
          <select defaultValue="Frisör">
            <option>Frisör</option>
            <option>Barber</option>
            <option>Salongschef</option>
          </select>
        </label>
        <Callout tone="info" icon="info">
          Magic-link = engångs-invite, inte löpande login. Rätt roll/access tilldelas
          direkt.
        </Callout>
      </div>
    </Drawer>
  )
}
