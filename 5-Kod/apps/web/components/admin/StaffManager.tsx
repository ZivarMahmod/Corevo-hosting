'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import type { ServiceRow, StaffWithServices } from '@/lib/admin/data'
import {
  createStaff,
  updateStaff,
  toggleStaffActive,
  deleteStaff,
  setStaffServices,
  type ActionState,
} from '@/lib/admin/actions'
import styles from './admin.module.css'

export function StaffManager({
  staff,
  services,
}: {
  staff: StaffWithServices[]
  services: ServiceRow[]
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createStaff, {})

  return (
    <div>
      <form action={formAction} className={styles.form}>
        <label className={styles.field} style={{ flex: '1 1 14rem' }}>
          <span>Namn / titel</span>
          <input name="title" placeholder="t.ex. Hilal — frisör" required />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Lägg till medarbetare'}
        </button>
        <Feedback state={state} />
      </form>

      {staff.length === 0 ? (
        <div className={styles.empty}>
          <strong>Ingen personal ännu.</strong>
          Lägg till din första medarbetare ovan och koppla sedan vilka tjänster hen utför.
        </div>
      ) : (
        <ul className={styles.list}>
          {staff.map((s) => (
            <StaffItem key={s.id} member={s} services={services} />
          ))}
        </ul>
      )}
    </div>
  )
}

function StaffItem({ member, services }: { member: StaffWithServices; services: ServiceRow[] }) {
  const [nameState, nameAction, namePending] = useActionState<ActionState, FormData>(updateStaff, {})
  const [svcState, svcAction, svcPending] = useActionState<ActionState, FormData>(setStaffServices, {})

  return (
    <li
      className={`${styles.row} ${member.active ? '' : styles.rowInactive}`}
      style={{ flexDirection: 'column', alignItems: 'stretch' }}
    >
      <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
        <form action={nameAction} className={styles.fieldRow}>
          <input type="hidden" name="id" value={member.id} />
          <label className={styles.field} style={{ flex: '1 1 14rem' }}>
            <span>Namn / titel</span>
            <input name="title" defaultValue={member.title ?? ''} required />
          </label>
          <button type="submit" className={styles.btn} disabled={namePending}>
            {namePending ? '…' : 'Spara'}
          </button>
        </form>
        <div className={styles.actions}>
          <ToggleButton id={member.id} active={member.active} />
          <DeleteButton id={member.id} />
        </div>
      </div>
      {nameState.error ? (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {nameState.error}
        </span>
      ) : null}

      <form action={svcAction}>
        <input type="hidden" name="staff_id" value={member.id} />
        <p className={styles.muted} style={{ margin: '0.25rem 0' }}>
          Utför tjänster:
        </p>
        {services.length === 0 ? (
          <p className={styles.muted}>
            Inga tjänster att koppla ännu —{' '}
            <Link href="/admin/tjanster" className={styles.navLink} style={{ fontSize: 'inherit' }}>
              skapa tjänster först
            </Link>
          </p>
        ) : (
          <div className={styles.checks}>
            {services.map((svc) => (
              <label key={svc.id} className={styles.check}>
                <input
                  type="checkbox"
                  name="service_id"
                  value={svc.id}
                  defaultChecked={member.serviceIds.includes(svc.id)}
                />
                {svc.name}
              </label>
            ))}
          </div>
        )}
        <div className={styles.actions} style={{ marginTop: '0.5rem' }}>
          <button type="submit" className={styles.btn} disabled={svcPending || services.length === 0}>
            {svcPending ? '…' : 'Spara tjänster'}
          </button>
          <Feedback state={svcState} />
        </div>
      </form>
    </li>
  )
}

function ToggleButton({ id, active }: { id: string; active: boolean }) {
  const [, formAction, pending] = useActionState<ActionState, FormData>(toggleStaffActive, {})
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
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteStaff, {})
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
