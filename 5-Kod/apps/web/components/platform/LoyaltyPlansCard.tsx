'use client'

import { useActionState, useState } from 'react'
import {
  createLoyaltyPlan,
  updateLoyaltyPlan,
  deleteLoyaltyPlan,
  type ActionState,
} from '@/lib/platform/actions'
import { centsToKronorInput } from '@/lib/platform/billing'
import { LOYALTY_INTERVAL_LABELS, LOYALTY_INTERVALS } from '@/lib/storefront/lojalitet/types'
import { Icon } from '@/components/portal/ui'
import styles from './platform.module.css'

/**
 * KLUBBENS NIVÅER i kundkortet (goal-64) — super-admin fyller loyalty_plans (0057) åt en
 * vald kund. Samma kompakta <details>-mönster som ServicesCard: varje nivå är en hopfälld
 * rad, klick fäller ut redigeraren.
 *
 * Nivåerna är det klubbsidan (/klubb) visar: Källas Droppe 195 / Källa 445 / Flod 745 kr
 * per månad, med sina förmåner och EN markerad nivå. Render-on-present gäller hela vägen —
 * skriver kunden inga nivåer visar klubbsidan inga nivåer, aldrig en påhittad pristavla.
 *
 * Priser i kr; servern räknar om till öre. Förmåner: en per rad.
 */
type LoyaltyPlanRow = {
  id: string
  name: string
  price_cents: number
  interval: string
  perks: string[]
  featured: boolean
  sort_order: number
  active: boolean
}

const kr = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 })

export function LoyaltyPlansCard({
  tenantId,
  plans,
}: {
  tenantId: string
  plans: LoyaltyPlanRow[]
}) {
  const sorted = [...plans].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'sv'),
  )
  return (
    <div>
      <p className={styles.hint} style={{ margin: 0 }}>
        Klubbens nivåer syns på kundens klubbsida (/klubb) när lojalitet-modulen är på. Inga
        nivåer → sidan visar bara programmet (poäng eller stämpelkort), inga priser.
      </p>

      <AddPlanForm tenantId={tenantId} />

      {sorted.length === 0 ? (
        <p className={styles.hint} style={{ marginTop: 12 }}>
          Inga nivåer ännu. En klubb utan nivåer är helt giltig — lägg bara till dem om kunden
          säljer medlemskap (t.ex. Droppe · Källa · Flod).
        </p>
      ) : (
        sorted.map((p) => <PlanRow key={p.id} tenantId={tenantId} plan={p} />)
      )}
    </div>
  )
}

function IntervalSelect({ value }: { value?: string }) {
  return (
    <label className={styles.field}>
      <span>Intervall</span>
      <select name="interval" defaultValue={value ?? 'month'}>
        {LOYALTY_INTERVALS.map((i) => (
          <option key={i} value={i}>
            {LOYALTY_INTERVAL_LABELS[i]}
          </option>
        ))}
      </select>
    </label>
  )
}

function AddPlanForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createLoyaltyPlan, {})
  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <p className={styles.groupTitle} style={{ padding: 0 }}>
        Lägg till nivå
      </p>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Namn</span>
          <input name="name" placeholder="t.ex. Droppe" required />
        </label>
        <label className={styles.field}>
          <span>Pris (kr)</span>
          <input name="price" inputMode="decimal" placeholder="0" />
        </label>
        <IntervalSelect />
      </div>
      <label className={styles.field}>
        <span>Förmåner (en per rad)</span>
        <textarea name="perks" rows={3} placeholder={'En ritual i månaden\n10 % i apoteket'} />
      </label>
      <div className={styles.actions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? 'Lägger till…' : 'Lägg till nivå'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

function PlanRow({ tenantId, plan }: { tenantId: string; plan: LoyaltyPlanRow }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateLoyaltyPlan, {})
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(deleteLoyaltyPlan, {})
  // Tvåstegsbekräftelse (samma mönster som ServicesCard): raderingen träffar KUNDENS nivå,
  // och den som klickar är inte den som drabbas.
  const [armed, setArmed] = useState(false)

  return (
    <details className={styles.svcRow}>
      <summary className={styles.svcSummary}>
        <span className={styles.svcSumMain}>
          <span className={styles.svcSumName}>
            {plan.name}
            {plan.featured ? <span className={styles.svcBadge}>Markerad</span> : null}
            {!plan.active ? <span className={styles.svcOff}>Avstängd</span> : null}
          </span>
          <span className={styles.svcSumMeta}>
            {LOYALTY_INTERVAL_LABELS[
              (LOYALTY_INTERVALS as readonly string[]).includes(plan.interval)
                ? (plan.interval as (typeof LOYALTY_INTERVALS)[number])
                : 'month'
            ]}
            {plan.perks.length > 0 ? ` · ${plan.perks.length} förmåner` : ''}
          </span>
        </span>
        <span className={styles.svcPrice}>{kr.format(plan.price_cents / 100)}</span>
        <Icon name="chevronDown" size={16} className={styles.svcChev} />
      </summary>

      <div className={styles.svcBody}>
        <form action={formAction} className={styles.svcSub}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="planId" value={plan.id} />
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span>Namn</span>
              <input name="name" defaultValue={plan.name} required />
            </label>
            <label className={styles.field}>
              <span>Pris (kr)</span>
              <input name="price" inputMode="decimal" defaultValue={centsToKronorInput(plan.price_cents)} />
            </label>
            <IntervalSelect value={plan.interval} />
          </div>
          <label className={styles.field}>
            <span>Förmåner (en per rad)</span>
            <textarea name="perks" rows={4} defaultValue={plan.perks.join('\n')} />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.field} style={{ maxWidth: 140 }}>
              <span>Sortering</span>
              <input name="sort_order" inputMode="numeric" defaultValue={String(plan.sort_order)} />
            </label>
            <label className={styles.svcCheck} style={{ alignSelf: 'end', paddingBottom: 10 }}>
              <input type="checkbox" name="featured" defaultChecked={plan.featured} />
              <span>Markerad nivå (mallens framhävda kort)</span>
            </label>
            <label className={styles.svcCheck} style={{ alignSelf: 'end', paddingBottom: 10 }}>
              <input type="checkbox" name="active" defaultChecked={plan.active} />
              <span>Aktiv (syns på klubbsidan)</span>
            </label>
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.btn} disabled={pending}>
              {pending ? 'Sparar…' : 'Spara'}
            </button>
            <Feedback state={state} />
          </div>
        </form>

        <div className={styles.svcSub}>
          <form action={delAction} className={styles.actions}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="planId" value={plan.id} />
            {armed ? (
              <>
                <button type="submit" className={styles.btnDanger} disabled={delPending}>
                  {delPending ? 'Tar bort…' : 'Säker? Ta bort permanent'}
                </button>
                <button type="button" className={styles.btn} disabled={delPending} onClick={() => setArmed(false)}>
                  Ångra
                </button>
              </>
            ) : (
              <button type="button" className={styles.btnDanger} onClick={() => setArmed(true)}>
                Ta bort nivå
              </button>
            )}
            <Feedback state={delState} />
          </form>
          <p className={styles.hint} style={{ margin: '6px 0 0' }}>
            Medlemmar som valt nivån blir kvar som medlemmar — bara nivån försvinner.
          </p>
        </div>
      </div>
    </details>
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
