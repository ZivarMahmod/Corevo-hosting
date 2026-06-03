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
    <div className="bo-2col" style={{ alignItems: 'start' }}>
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
      <StorefrontSiteMap services={services} />
    </div>
  )
}

/** Live storefront site-map (playbook §4.4) — mirrors where each service shows up
 *  on the public site, grouped by category section. Derived from the same services
 *  prop, so a toggle/section edit re-revalidates the page and the map updates with
 *  no extra code or deploy. Active = a chip under its section; inactive = listed as
 *  hidden. Read-only reflection — the real edits live in the table on the left. */
function StorefrontSiteMap({ services }: { services: ServiceRow[] }) {
  const active = services.filter((s) => s.active)
  const hidden = services.filter((s) => !s.active)

  const sections = new Map<string, ServiceRow[]>()
  for (const s of active) {
    const key = s.category?.trim() || 'Övrigt'
    const arr = sections.get(key)
    if (arr) arr.push(s)
    else sections.set(key, [s])
  }
  const sectionList = [...sections.entries()]

  return (
    <aside
      style={{
        position: 'sticky',
        top: 84,
        background: 'var(--c-cream)',
        border: '1px solid var(--c-line)',
        borderRadius: 16,
        padding: 18,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 2 }}>
        Var det syns på hemsidan
      </div>
      <p className="num" style={{ fontSize: 13, color: 'var(--c-ink-3)', margin: '0 0 14px' }}>
        Din publika sajt → Tjänster
      </p>

      {sectionList.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--c-ink-2)' }}>
          Inga aktiva tjänster — ingenting visas i tjänstemenyn ännu.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sectionList.map(([name, items]) => (
            <div
              key={name}
              style={{
                background: 'var(--c-paper-2)',
                border: '1px solid var(--c-line)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--c-forest)',
                  marginBottom: 8,
                }}
              >
                {name}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      fontSize: 12.5,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'var(--c-cream)',
                      border: '1px solid var(--c-line)',
                      color: 'var(--c-ink)',
                    }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hidden.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--c-ink-3)',
              marginBottom: 8,
            }}
          >
            Dold på sajten
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {hidden.map((s) => (
              <span
                key={s.id}
                style={{
                  fontSize: 12.5,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'transparent',
                  border: '1px dashed var(--c-line-strong)',
                  color: 'var(--c-ink-3)',
                }}
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--c-ink-3)', margin: '14px 0 0' }}>
        Ändringar slår igenom utan kod eller deploy.
      </p>
    </aside>
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
        <PlacementBadge active={service.active} />
        <ToggleButton id={service.id} active={service.active} />
        <DeleteButton id={service.id} />
      </div>
      <Feedback state={state} />
    </li>
  )
}

/** Where the service shows up on the storefront (M6 §3.3). Active services appear
 *  in the public service-menu (homepage section + the full /tjanster page) and are
 *  bookable, ordered by price; inactive ones are hidden but keep their history. */
function PlacementBadge({ active }: { active: boolean }) {
  return (
    <span
      className={styles.badge}
      title={
        active
          ? 'Syns i tjänstemenyn på startsidan och /tjanster, och går att boka.'
          : 'Dold på den publika sajten. Historiken finns kvar.'
      }
    >
      {active ? 'Syns på sajten + bokning' : 'Dold på sajten'}
    </span>
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
