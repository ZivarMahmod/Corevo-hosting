'use client'

import { useActionState } from 'react'
import type { ServiceRow } from '@/lib/admin/data'
import {
  createService,
  updateService,
  toggleServiceActive,
  deleteService,
  type ActionState,
} from '@/lib/admin/actions'
import { centsToKronorInput, formatPrice } from '@/lib/admin/format'
import styles from './admin.module.css'

export function ServicesManager({ services }: { services: ServiceRow[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createService, {})

  return (
    <div>
      <form action={formAction} className={styles.form}>
        <label className={styles.field}>
          <span>Namn</span>
          <input name="name" required />
        </label>
        <label className={styles.field}>
          <span>Kategori</span>
          <input name="category" placeholder="t.ex. Klippning" />
        </label>
        <label className={styles.field}>
          <span>Varaktighet (min)</span>
          <input name="duration_min" type="number" min="1" step="5" defaultValue="30" required />
        </label>
        <label className={styles.field}>
          <span>Pris (kr)</span>
          <input name="price" type="text" inputMode="decimal" placeholder="0" />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Lägg till tjänst'}
        </button>
        <Feedback state={state} />
      </form>

      {services.length === 0 ? (
        <div className={styles.empty}>
          <strong>Inga tjänster ännu.</strong>
          Lägg till din första tjänst i formuläret ovan — namn, varaktighet och pris. Den blir genast
          bokningsbar på din publika sajt.
        </div>
      ) : (
        <ul className={styles.list}>
          {services.map((s) => (
            <ServiceItem key={s.id} service={s} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ServiceItem({ service }: { service: ServiceRow }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateService, {})

  return (
    <li className={`${styles.row} ${service.active ? '' : styles.rowInactive}`}>
      <form action={formAction} className={styles.fieldRow} style={{ flex: 1 }}>
        <input type="hidden" name="id" value={service.id} />
        <label className={styles.field} style={{ flex: '2 1 8rem' }}>
          <span>Namn</span>
          <input name="name" defaultValue={service.name} required />
        </label>
        <label className={styles.field} style={{ flex: '1 1 6rem' }}>
          <span>Kategori</span>
          <input name="category" defaultValue={service.category ?? ''} />
        </label>
        <label className={styles.field} style={{ flex: '0 1 6rem' }}>
          <span>Min</span>
          <input name="duration_min" type="number" min="1" step="5" defaultValue={service.duration_min} required />
        </label>
        <label className={styles.field} style={{ flex: '0 1 6rem' }}>
          <span>Pris (kr)</span>
          <input name="price" type="text" inputMode="decimal" defaultValue={centsToKronorInput(service.price_cents)} />
        </label>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? '…' : 'Spara'}
        </button>
      </form>

      <div className={styles.actions}>
        <span className={styles.muted}>{formatPrice(service.price_cents)}</span>
        <ToggleButton id={service.id} active={service.active} />
        <DeleteButton id={service.id} />
      </div>
      <Feedback state={state} />
    </li>
  )
}

function ToggleButton({ id, active }: { id: string; active: boolean }) {
  const [, formAction, pending] = useActionState<ActionState, FormData>(toggleServiceActive, {})
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <button type="submit" className={styles.btn} disabled={pending}>
        {pending ? '…' : active ? 'Inaktivera' : 'Aktivera'}
      </button>
    </form>
  )
}

function DeleteButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteService, {})
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`${styles.btn} ${styles.btnDanger}`} disabled={pending}>
        {pending ? '…' : 'Ta bort'}
      </button>
      {state.error ? (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p className={`${styles.feedback} auth-error`} role="alert">
        {state.error}
      </p>
    )
  if (state.success)
    return (
      <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
        {state.success}
      </p>
    )
  return null
}
