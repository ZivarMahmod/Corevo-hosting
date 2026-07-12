'use client'

import { useActionState } from 'react'
import {
  createTenantStaff,
  inviteTenantStaff,
  updateTenantStaff,
  removeTenantStaff,
  setStaffSchedule,
  setStaffServices,
  type ActionState,
} from '@/lib/platform/actions'
import { Icon } from '@/components/portal/ui'
import styles from './platform.module.css'

/**
 * Super-admin personal-hantering för EN salong. Kompakt lista (native <details>) —
 * varje medarbetare en hopfälld rad, klick fäller ut: redigera namn/aktiv, veckoschema
 * (öppettiderna på storefront härleds ur detta), ge inlogg (magic-link), inaktivera
 * (mjuk — historik sparas). Överst två sätt att lägga till: utan konto (titel) eller
 * med inlogg (e-post → konto + magic-link). Allt platform_admin-gatat i server-lagret.
 */
type StaffHour = { weekday: number; start: string; end: string }
type Staff = { id: string; title: string | null; active: boolean; hours: StaffHour[]; serviceIds: string[] }
type ServiceOption = { id: string; name: string }

const WEEK: { weekday: number; label: string }[] = [
  { weekday: 1, label: 'Måndag' },
  { weekday: 2, label: 'Tisdag' },
  { weekday: 3, label: 'Onsdag' },
  { weekday: 4, label: 'Torsdag' },
  { weekday: 5, label: 'Fredag' },
  { weekday: 6, label: 'Lördag' },
  { weekday: 0, label: 'Söndag' },
]

export function PersonalCard({
  tenantId,
  staff,
  services,
  serviceRoleAvailable,
}: {
  tenantId: string
  staff: Staff[]
  services: ServiceOption[]
  serviceRoleAvailable: boolean
}) {
  return (
    <div>
      <AddStaff tenantId={tenantId} serviceRoleAvailable={serviceRoleAvailable} />
      {staff.length === 0 ? (
        <p className={styles.hint} style={{ marginTop: 12 }}>
          Ingen personal ännu — lägg till första medarbetaren ovan. Bokningsmotorn kräver minst en
          aktiv medarbetare med arbetstider + kopplad tjänst.
        </p>
      ) : (
        <div className={styles.svcGroup}>
          {staff.map((s) => (
            <StaffRow
              key={s.id}
              tenantId={tenantId}
              staff={s}
              services={services}
              serviceRoleAvailable={serviceRoleAvailable}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Lägg till: utan konto (titel) ELLER med inlogg (e-post) ──────────────────────
function AddStaff({ tenantId, serviceRoleAvailable }: { tenantId: string; serviceRoleAvailable: boolean }) {
  const [addState, addAction, addPending] = useActionState<ActionState, FormData>(createTenantStaff, {})
  const [invState, invAction, invPending] = useActionState<ActionState, FormData>(inviteTenantStaff, {})
  return (
    <div className={styles.form}>
      <p className={styles.groupTitle} style={{ padding: 0 }}>
        Lägg till personal
      </p>
      {/* Utan konto — bara titel, syns i bokningen direkt. */}
      <form action={addAction}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <div className={styles.fieldRow}>
          <label className={styles.field} style={{ flex: 1 }}>
            <span>Namn / titel</span>
            <input name="title" placeholder="t.ex. Anna – teamledare" required />
          </label>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.btn} disabled={addPending}>
            {addPending ? 'Lägger till…' : 'Lägg till (utan inlogg)'}
          </button>
          <Feedback state={addState} />
        </div>
      </form>

      {/* Med inlogg — skapar konto + skickar magic-link. */}
      <form action={invAction} style={{ marginTop: '0.6rem' }}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <p className={styles.hint} style={{ marginTop: 0 }}>
          …eller bjud in med eget inlogg (medarbetaren får en magic-link och sätter lösenord själv):
        </p>
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Namn / titel</span>
            <input name="title" placeholder="t.ex. Anna – teamledare" />
          </label>
          <label className={styles.field}>
            <span>E-post</span>
            <input name="email" type="email" inputMode="email" placeholder="anna@exempel.se" required />
          </label>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.btn} disabled={invPending || !serviceRoleAvailable}>
            {invPending ? 'Skickar…' : 'Bjud in med inlogg'}
          </button>
          <Feedback state={invState} />
        </div>
        {!serviceRoleAvailable ? (
          <p className={styles.hint} style={{ marginTop: '0.4rem' }}>
            Inbjudan kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops).
          </p>
        ) : null}
      </form>
    </div>
  )
}

// ── En medarbetare: hopfälld rad → redigera / schema / inlogg / inaktivera ───────
function StaffRow({
  tenantId,
  staff,
  services,
  serviceRoleAvailable,
}: {
  tenantId: string
  staff: Staff
  services: ServiceOption[]
  serviceRoleAvailable: boolean
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateTenantStaff, {})
  const [svcState, svcAction, svcPending] = useActionState<ActionState, FormData>(setStaffServices, {})
  const [schedState, schedAction, schedPending] = useActionState<ActionState, FormData>(setStaffSchedule, {})
  const [invState, invAction, invPending] = useActionState<ActionState, FormData>(inviteTenantStaff, {})
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(removeTenantStaff, {})

  const byWeekday = new Map<number, StaffHour>()
  for (const h of staff.hours) byWeekday.set(h.weekday, h)
  const workDays = staff.hours.length
  const svcCount = staff.serviceIds.length
  // Bookable = active + ≥1 service linked + ≥1 work day. Surfaced so the operator sees
  // WHY a staff can't be picked in "Hos vem?" (usually the missing tjänst-koppling).
  const bookable = staff.active && svcCount > 0 && workDays > 0

  return (
    <details className={styles.svcRow}>
      <summary className={styles.svcSummary}>
        <span className={`${styles.svcThumb} ${styles.svcThumbEmpty}`}>
          <Icon name="scissors" size={16} />
        </span>
        <span className={styles.svcSumMain}>
          <span className={styles.svcSumName}>
            {staff.title || 'Medarbetare'}
            {!staff.active ? (
              <span className={styles.svcOff}>Inaktiv</span>
            ) : bookable ? (
              <span className={styles.svcBadge}>Bokningsbar</span>
            ) : (
              <span className={styles.svcOff}>Ej bokningsbar</span>
            )}
          </span>
          <span className={styles.svcSumMeta}>
            {svcCount > 0 ? `${svcCount} tjänst${svcCount === 1 ? '' : 'er'}` : 'ingen tjänst kopplad'}
            {' · '}
            {workDays > 0 ? `${workDays} arbetsdag${workDays === 1 ? '' : 'ar'}/vecka` : 'inget schema'}
          </span>
        </span>
        <Icon name="chevronDown" size={16} className={styles.svcChev} />
      </summary>

      <div className={styles.svcBody}>
        {/* Namn/titel + aktiv */}
        <form action={formAction} className={styles.svcSub}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="staffId" value={staff.id} />
          <div className={styles.fieldRow}>
            <label className={styles.field} style={{ flex: 1 }}>
              <span>Namn / titel</span>
              <input name="title" defaultValue={staff.title ?? ''} required />
            </label>
          </div>
          <label className={styles.svcCheck}>
            <input type="checkbox" name="active" defaultChecked={staff.active} />
            <span>Aktiv (syns i bokningen)</span>
          </label>
          <div className={styles.actions}>
            <button type="submit" className={styles.btn} disabled={pending}>
              {pending ? 'Sparar…' : 'Spara'}
            </button>
            <Feedback state={state} />
          </div>
        </form>

        {/* Tjänster medarbetaren utför (staff_services) — gör dem valbara i bokningen */}
        <form action={svcAction} className={styles.svcSub}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="staffId" value={staff.id} />
          <p className={styles.svcSubTitle}>Tjänster medarbetaren utför</p>
          {services.length === 0 ? (
            <p className={styles.hint} style={{ margin: 0 }}>
              Företaget har inga tjänster än — lägg till i Tjänster-fliken först.
            </p>
          ) : (
            <>
              <div className={styles.svcStaffGrid}>
                {services.map((sv) => (
                  <label key={sv.id} className={styles.svcCheck}>
                    <input
                      type="checkbox"
                      name="serviceId"
                      value={sv.id}
                      defaultChecked={staff.serviceIds.includes(sv.id)}
                    />
                    <span>{sv.name}</span>
                  </label>
                ))}
              </div>
              <p className={styles.hint} style={{ margin: 0 }}>
                Utan kopplad tjänst går medarbetaren inte att välja i bokningens &quot;Hos vem?&quot;.
              </p>
              <div className={styles.actions}>
                <button type="submit" className={styles.btn} disabled={svcPending}>
                  {svcPending ? 'Sparar…' : 'Spara tjänster'}
                </button>
                <Feedback state={svcState} />
              </div>
            </>
          )}
        </form>

        {/* Veckoschema */}
        <form action={schedAction} className={styles.svcSub}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="staffId" value={staff.id} />
          <p className={styles.svcSubTitle}>Veckoschema (öppettider härleds från detta)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {WEEK.map(({ weekday, label }) => {
              const h = byWeekday.get(weekday)
              return (
                <div key={weekday} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '7.5rem', fontSize: '0.85rem' }}>
                    <input type="checkbox" name={`open_${weekday}`} defaultChecked={!!h} />
                    <span>{label}</span>
                  </label>
                  <input type="time" name={`start_${weekday}`} defaultValue={h?.start ?? '09:00'} aria-label={`${label} starttid`} style={timeInputStyle} />
                  <span className={styles.hint} style={{ marginTop: 0 }}>
                    –
                  </span>
                  <input type="time" name={`end_${weekday}`} defaultValue={h?.end ?? '17:00'} aria-label={`${label} sluttid`} style={timeInputStyle} />
                </div>
              )
            })}
          </div>
          <p className={styles.hint} style={{ marginTop: '0.3rem' }}>
            Kryssa dagar medarbetaren jobbar. Sparar hela veckan — obockade dagar = stängt.
          </p>
          <div className={styles.actions}>
            <button type="submit" className={styles.btn} disabled={schedPending}>
              {schedPending ? 'Sparar schema…' : 'Spara schema'}
            </button>
            <Feedback state={schedState} />
          </div>
        </form>

        {/* Ge inlogg (magic-link) till denna medarbetare */}
        {serviceRoleAvailable ? (
          <form action={invAction} className={styles.svcSub}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="staffId" value={staff.id} />
            <p className={styles.svcSubTitle}>Ge inlogg</p>
            <div className={styles.fieldRow}>
              <label className={styles.field} style={{ flex: 1 }}>
                <span>E-post</span>
                <input name="email" type="email" inputMode="email" placeholder="anna@exempel.se" required />
              </label>
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.btn} disabled={invPending}>
                {invPending ? 'Skickar…' : 'Skicka inbjudan'}
              </button>
              <Feedback state={invState} />
            </div>
          </form>
        ) : null}

        {/* Inaktivera (mjuk) */}
        <form action={delAction} className={styles.svcSub}>
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
    </details>
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
