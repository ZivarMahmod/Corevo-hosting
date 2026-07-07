'use client'

import { useActionState } from 'react'
import {
  createTenantService,
  updateTenantService,
  deleteTenantService,
  type ActionState,
} from '@/lib/platform/actions'
import { centsToKronorInput } from '@/lib/platform/billing'
import styles from './platform.module.css'

/**
 * Ongoing super-admin services management for a CHOSEN salon (mounted in the Data-tab
 * next to OperativeControls). Renders the tenant's services as an editable list: one
 * add-form on top, then one edit-form per service (namn · pris · längd · aktiv) plus a
 * separate delete-form — one-form-one-action, matching the OperativeControls pattern.
 * Prices display/edit in kr; the server converts to öre. All three actions are
 * platform_admin-gated in the server layer.
 */
type Service = {
  id: string
  name: string
  price_cents: number
  duration_min: number
  active: boolean
}

export function ServicesCard({
  tenantId,
  services,
}: {
  tenantId: string
  services: Service[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <AddServiceForm tenantId={tenantId} />
      {services.length === 0 ? (
        <p className={styles.hint} style={{ marginTop: 0 }}>
          Inga tjänster ännu — lägg till salongens första tjänst ovan. Bokningsmotorn kräver
          minst en aktiv tjänst för att kunna ta emot bokningar.
        </p>
      ) : (
        services.map((s) => <ServiceRow key={s.id} tenantId={tenantId} service={s} />)
      )}
    </div>
  )
}

// ── Lägg till tjänst ────────────────────────────────────────────────────────────
function AddServiceForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTenantService, {})

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <p className={styles.groupTitle} style={{ padding: 0 }}>
        Lägg till tjänst
      </p>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        Hantera salongens tjänster åt kunden. Pris i kronor, längd i minuter (standard 30).
      </p>

      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Namn</span>
          <input name="name" placeholder="t.ex. Klippning" required />
        </label>
        <label className={styles.field}>
          <span>Pris (kr)</span>
          <input name="price" inputMode="decimal" placeholder="0" />
        </label>
        <label className={styles.field}>
          <span>Längd (min)</span>
          <input name="duration_min" inputMode="numeric" defaultValue="30" />
        </label>
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? 'Lägger till…' : 'Lägg till tjänst'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

// ── Redigera / ta bort en tjänst (namn · pris · längd · aktiv) ──────────────────
function ServiceRow({ tenantId, service }: { tenantId: string; service: Service }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateTenantService, {})
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(
    deleteTenantService,
    {},
  )

  return (
    <div className={styles.form}>
      <form action={formAction}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="serviceId" value={service.id} />

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Namn</span>
            <input name="name" defaultValue={service.name} required />
          </label>
          <label className={styles.field}>
            <span>Pris (kr)</span>
            <input name="price" inputMode="decimal" defaultValue={centsToKronorInput(service.price_cents)} />
          </label>
          <label className={styles.field}>
            <span>Längd (min)</span>
            <input name="duration_min" inputMode="numeric" defaultValue={String(service.duration_min)} />
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.4rem' }}>
          <input type="checkbox" name="active" defaultChecked={service.active} />
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

      {/* Separat delete-form (one-form-one-action) — egen hidden tenantId+serviceId. */}
      <form action={delAction} style={{ marginTop: '0.4rem' }}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="serviceId" value={service.id} />
        <div className={styles.actions}>
          <button type="submit" className={styles.btnDanger} disabled={delPending}>
            {delPending ? 'Tar bort…' : 'Ta bort'}
          </button>
          <Feedback state={delState} />
        </div>
      </form>
    </div>
  )
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
