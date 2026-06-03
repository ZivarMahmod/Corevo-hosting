'use client'

import { useActionState } from 'react'
import type { LocationRow } from '@/lib/admin/data'
import {
  createLocation,
  updateLocation,
  setPrimaryLocation,
  toggleLocationActive,
  type ActionState,
} from '@/lib/admin/actions'
import styles from './admin.module.css'

export function LocationsManager({ locations }: { locations: LocationRow[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createLocation, {})

  return (
    <div>
      <form action={formAction} className={styles.form}>
        <label className={styles.field} style={{ flex: '2 1 10rem' }}>
          <span>Namn</span>
          <input name="name" placeholder="t.ex. Salongen Söder" required />
        </label>
        <label className={styles.field} style={{ flex: '2 1 12rem' }}>
          <span>Adress</span>
          <input name="address" placeholder="Gata 1, 111 22 Stad" />
        </label>
        <label className={styles.field} style={{ flex: '1 1 9rem' }}>
          <span>Tidszon</span>
          <input name="timezone" placeholder="Europe/Stockholm" />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Lägg till plats'}
        </button>
        <Feedback state={state} />
      </form>

      {locations.length === 0 ? (
        <div className={styles.empty}>
          <strong>Inga platser ännu.</strong>
          Lägg till din första plats i formuläret ovan. Den första du gör till primär blir den som
          bokningar och den publika sajten utgår från.
        </div>
      ) : (
        <ul className={styles.list}>
          {locations.map((l) => (
            <LocationItem key={l.id} location={l} />
          ))}
        </ul>
      )}
    </div>
  )
}

function LocationItem({ location }: { location: LocationRow }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateLocation, {})

  return (
    <li className={`${styles.row} ${location.active ? '' : styles.rowInactive}`}>
      <form action={formAction} className={styles.fieldRow} style={{ flex: 1 }}>
        <input type="hidden" name="id" value={location.id} />
        <label className={styles.field} style={{ flex: '2 1 8rem' }}>
          <span>Namn</span>
          <input name="name" defaultValue={location.name} required />
        </label>
        <label className={styles.field} style={{ flex: '2 1 10rem' }}>
          <span>Adress</span>
          <input name="address" defaultValue={location.address ?? ''} />
        </label>
        <label className={styles.field} style={{ flex: '1 1 8rem' }}>
          <span>Tidszon</span>
          <input name="timezone" defaultValue={location.timezone} />
        </label>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? '…' : 'Spara'}
        </button>
      </form>

      <div className={styles.actions}>
        <PrimaryBadge isPrimary={location.is_primary} active={location.active} />
        <SetPrimaryButton
          id={location.id}
          isPrimary={location.is_primary}
          active={location.active}
        />
        <ToggleButton id={location.id} active={location.active} isPrimary={location.is_primary} />
      </div>
      <Feedback state={state} />
    </li>
  )
}

/** The primary location is the one bookings + the public site resolve from. Active
 *  state mirrors the services placement badge. */
function PrimaryBadge({ isPrimary, active }: { isPrimary: boolean; active: boolean }) {
  if (isPrimary)
    return (
      <span
        className={styles.badge}
        title="Bokningar och den publika sajten utgår från denna plats. Kan inte inaktiveras."
      >
        Primär plats
      </span>
    )
  return (
    <span
      className={styles.badge}
      title={active ? 'Aktiv filial. Kan kopplas till scheman.' : 'Inaktiv. Dold för nya scheman.'}
    >
      {active ? 'Aktiv' : 'Inaktiv'}
    </span>
  )
}

function SetPrimaryButton({
  id,
  isPrimary,
  active,
}: {
  id: string
  isPrimary: boolean
  active: boolean
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setPrimaryLocation, {})
  // Disabled on the current primary (no-op) and on inactive locations (you'd create
  // an inactive primary that can't then be deactivated-away). Activate it first.
  const disabled = pending || isPrimary || !active
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={styles.btn}
        disabled={disabled}
        title={
          isPrimary
            ? 'Detta är redan den primära platsen.'
            : !active
              ? 'Aktivera platsen innan du gör den till primär.'
              : 'Gör denna plats till salongens primära plats.'
        }
      >
        {pending ? '…' : 'Gör till primär'}
      </button>
      {state.error ? (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}

function ToggleButton({
  id,
  active,
  isPrimary,
}: {
  id: string
  active: boolean
  isPrimary: boolean
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    toggleLocationActive,
    {},
  )
  // The primary location can't be deactivated (load-bearing for bookings). Disable
  // the button there so the refusal is also clear in the UI.
  const disabled = pending || (active && isPrimary)
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <button
        type="submit"
        className={styles.btn}
        disabled={disabled}
        title={
          active && isPrimary
            ? 'Den primära platsen kan inte inaktiveras. Gör en annan plats till primär först.'
            : active
              ? 'Inaktivera platsen.'
              : 'Aktivera platsen.'
        }
      >
        {pending ? '…' : active ? 'Inaktivera' : 'Aktivera'}
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
