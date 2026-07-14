'use client'

import { useActionState } from 'react'
import { setCustomerHidden, setCustomerSelfBook, type ActionState } from '@/lib/admin/actions'
import styles from './admin.module.css'

/** Kundkortets styrflaggor (goal-66, B-25).
 *
 *  Dölj kund = soft delete. Kunden försvinner ur listor och sök men historiken finns
 *  kvar, och ett klick tar tillbaka hen. GDPR-radering är en ANNAN väg (anonymized,
 *  enkelriktad) — de två får aldrig se ut som samma knapp.
 *
 *  Får boka själv = av för kunder som upprepat uteblir. Salongen bokar åt dem i
 *  kalendern (den vägen påverkas aldrig); sajten och kundkontot säger nej. */

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

export function CustomerFlags({
  customerId,
  hidden,
  selfBook,
}: {
  customerId: string
  hidden: boolean
  selfBook: boolean
}) {
  const [hideState, hideAction, hidePending] = useActionState<ActionState, FormData>(
    setCustomerHidden,
    {},
  )
  const [bookState, bookAction, bookPending] = useActionState<ActionState, FormData>(
    setCustomerSelfBook,
    {},
  )

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <form action={bookAction} style={{ margin: 0 }}>
        <input type="hidden" name="customer_id" value={customerId} />
        <input type="hidden" name="allow" value={selfBook ? '0' : '1'} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-ink)' }}>
              Får boka själv
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.45 }}>
              {selfBook
                ? 'Kunden kan boka via sajten och sitt konto.'
                : 'Avstängd — ni bokar åt kunden i kalendern.'}
            </div>
          </div>
          <button
            type="submit"
            className="btn-secondary"
            disabled={bookPending}
            role="switch"
            aria-checked={selfBook}
          >
            {bookPending ? 'Sparar…' : selfBook ? 'Stäng av' : 'Slå på'}
          </button>
        </div>
        <Feedback state={bookState} />
      </form>

      <form action={hideAction} style={{ margin: 0 }}>
        <input type="hidden" name="customer_id" value={customerId} />
        <input type="hidden" name="hide" value={hidden ? '0' : '1'} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-ink)' }}>
              {hidden ? 'Kunden är dold' : 'Dölj kund'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.45 }}>
              {hidden
                ? 'Syns inte i listor eller sök. All historik finns kvar.'
                : 'Tar bort kunden ur listor och sök — historiken behålls, inget raderas.'}
            </div>
          </div>
          <button
            type="submit"
            className="btn-secondary"
            disabled={hidePending}
            style={hidden ? undefined : { color: 'var(--c-danger)' }}
          >
            {hidePending ? 'Sparar…' : hidden ? 'Visa igen' : 'Dölj'}
          </button>
        </div>
        <Feedback state={hideState} />
      </form>
    </div>
  )
}
