'use client'

import { useActionState } from 'react'
import {
  updateTenantStaff,
  removeTenantStaff,
  setStaffSchedule,
  type ActionState,
} from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Ongoing super-admin personal-hantering for a CHOSEN salon (mounted in the Personal
 * tab, replacing the old read-only staff table). Renders the tenant's staff as an
 * editable list: per staff a title+active edit-form, a soft-remove (deactivate) form,
 * and a weekly schedule editor writing working_hours — all one-form-one-action,
 * mirroring ServicesCard. Every action is platform_admin-gated in the server layer;
 * "Lägg till personal" stays where it is (Data-tab, createTenantStaff) per the task.
 */
type StaffHour = { weekday: number; start: string; end: string }
type Staff = {
  id: string
  title: string | null
  active: boolean
  hours: StaffHour[]
}

// Display order Mån→Sön, carrying the DB weekday value (0=Sunday..6=Saturday) so the
// stored/submitted number is always the real weekday, never the render index.
const WEEK: { weekday: number; label: string }[] = [
  { weekday: 1, label: 'Måndag' },
  { weekday: 2, label: 'Tisdag' },
  { weekday: 3, label: 'Onsdag' },
  { weekday: 4, label: 'Torsdag' },
  { weekday: 5, label: 'Fredag' },
  { weekday: 6, label: 'Lördag' },
  { weekday: 0, label: 'Söndag' },
]

export function PersonalCard({ tenantId, staff }: { tenantId: string; staff: Staff[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {staff.length === 0 ? (
        <p className={styles.hint} style={{ marginTop: 0 }}>
          Ingen personal ännu — lägg till första medarbetaren i Data-fliken (Lägg till personal).
          Bokningsmotorn kräver minst en aktiv medarbetare med arbetstider.
        </p>
      ) : (
        staff.map((s) => <StaffRow key={s.id} tenantId={tenantId} staff={s} />)
      )}
    </div>
  )
}

// ── Redigera / ta bort / schema för en medarbetare ──────────────────────────────
function StaffRow({ tenantId, staff }: { tenantId: string; staff: Staff }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateTenantStaff, {})
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(
    removeTenantStaff,
    {},
  )
  const [schedState, schedAction, schedPending] = useActionState<ActionState, FormData>(
    setStaffSchedule,
    {},
  )

  // Index the staff's stored hours by DB weekday so each row seeds its own defaults.
  const byWeekday = new Map<number, StaffHour>()
  for (const h of staff.hours) byWeekday.set(h.weekday, h)

  return (
    <div className={styles.form}>
      {/* Namn/titel + aktiv */}
      <form action={formAction}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="staffId" value={staff.id} />

        <div className={styles.fieldRow}>
          <label className={styles.field} style={{ flex: 1 }}>
            <span>Namn / titel</span>
            <input name="title" defaultValue={staff.title ?? ''} required />
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.4rem' }}>
          <input type="checkbox" name="active" defaultChecked={staff.active} />
          <span className={styles.hint} style={{ marginTop: 0 }}>
            Aktiv (syns i bokningen)
          </span>
        </label>

        <div className={styles.actions}>
          <button type="submit" className={styles.btn} disabled={pending}>
            {pending ? 'Sparar…' : 'Spara'}
          </button>
          <Feedback state={state} />
        </div>
      </form>

      {/* Veckoschema (working_hours) — en form, en action. */}
      <form action={schedAction} style={{ marginTop: '0.6rem' }}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="staffId" value={staff.id} />
        <p className={styles.groupTitle} style={{ padding: 0, fontSize: '0.9rem' }}>
          Veckoschema (öppettider härleds från detta)
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
          {WEEK.map(({ weekday, label }) => {
            const h = byWeekday.get(weekday)
            return (
              <div
                key={weekday}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    minWidth: '7.5rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <input type="checkbox" name={`open_${weekday}`} defaultChecked={!!h} />
                  <span>{label}</span>
                </label>
                <input
                  type="time"
                  name={`start_${weekday}`}
                  defaultValue={h?.start ?? '09:00'}
                  aria-label={`${label} starttid`}
                  style={timeInputStyle}
                />
                <span className={styles.hint} style={{ marginTop: 0 }}>
                  –
                </span>
                <input
                  type="time"
                  name={`end_${weekday}`}
                  defaultValue={h?.end ?? '17:00'}
                  aria-label={`${label} sluttid`}
                  style={timeInputStyle}
                />
              </div>
            )
          })}
        </div>
        <p className={styles.hint} style={{ marginTop: '0.5rem' }}>
          Kryssa i de dagar medarbetaren jobbar. Sparar hela veckan på en gång — obockade
          dagar räknas som stängt.
        </p>
        <div className={styles.actions} style={{ marginTop: '0.5rem' }}>
          <button type="submit" className={styles.btn} disabled={schedPending}>
            {schedPending ? 'Sparar schema…' : 'Spara schema'}
          </button>
          <Feedback state={schedState} />
        </div>
      </form>

      {/* Separat inaktivera-form (mjuk borttagning — historik sparas). */}
      <form action={delAction} style={{ marginTop: '0.5rem' }}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="staffId" value={staff.id} />
        <div className={styles.actions}>
          <button type="submit" className={styles.btnDanger} disabled={delPending || !staff.active}>
            {delPending ? 'Inaktiverar…' : staff.active ? 'Inaktivera' : 'Redan inaktiv'}
          </button>
          <Feedback state={delState} />
        </div>
      </form>
    </div>
  )
}

const timeInputStyle: React.CSSProperties = {
  font: 'inherit',
  padding: '0.35rem 0.45rem',
  borderRadius: 'var(--radius-sm, 0.375rem)',
  border: '1px solid color-mix(in srgb, var(--c-ink) 22%, transparent)',
  background: 'transparent',
  color: 'inherit',
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <span className={`${styles.feedback} auth-error`} role="alert">
        {state.error}
      </span>
    )
  if (state.success)
    return (
      <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
        {state.success}
      </span>
    )
  return null
}
