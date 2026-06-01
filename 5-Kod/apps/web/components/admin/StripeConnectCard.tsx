'use client'

import { useActionState, useEffect, useRef } from 'react'
import {
  startStripeOnboarding,
  refreshStripeStatus,
  setPaymentsEnabled,
  type StripeActionState,
} from '@/lib/admin/stripe'
import styles from './admin.module.css'

export type StripeConnectCardProps = {
  hasAccount: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  paymentsEnabled: boolean
  /** True right after returning from the Stripe-hosted onboarding (?stripe=return). */
  justReturned: boolean
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`${styles.statePill} ${ok ? styles.statePillOn : styles.statePillOff}`}>
      {ok ? '✓' : '•'} {label}
    </span>
  )
}

export function StripeConnectCard(props: StripeConnectCardProps) {
  const [onboardState, onboardAction, onboarding] = useActionState<StripeActionState, FormData>(
    startStripeOnboarding,
    {},
  )
  const [refreshState, refreshAction, refreshing] = useActionState<StripeActionState, FormData>(
    refreshStripeStatus,
    {},
  )
  const [toggleState, toggleAction, toggling] = useActionState<StripeActionState, FormData>(
    setPaymentsEnabled,
    {},
  )

  // After returning from Stripe-hosted onboarding, pull fresh status once so
  // charges_enabled reflects immediately (no need to wait for the webhook).
  const refreshRef = useRef<HTMLFormElement>(null)
  const autoRefreshed = useRef(false)
  useEffect(() => {
    if (props.justReturned && props.hasAccount && !autoRefreshed.current) {
      autoRefreshed.current = true
      refreshRef.current?.requestSubmit()
    }
  }, [props.justReturned, props.hasAccount])

  const feedback = onboardState.error || refreshState.error || toggleState.error || refreshState.success || toggleState.success

  return (
    <div className={`${styles.section} ${styles.card}`} style={{ marginTop: '2rem' }}>
      <h2 style={{ marginTop: 0 }}>Betalningar (Stripe)</h2>
      <p className="prose">
        Ta betalt för tjänsten direkt vid bokning. Pengarna går rakt till din salong via Stripe —
        Corevo tar inget på transaktionen. Koppla ett Stripe-konto, slutför onboarding och slå sedan
        på onlinebetalning.
      </p>

      {props.hasAccount ? (
        <ul className={styles.stripeStatus}>
          <li>
            <Badge ok={props.detailsSubmitted} label="Uppgifter inskickade" />
          </li>
          <li>
            <Badge ok={props.chargesEnabled} label="Kortbetalning aktiv" />
          </li>
          <li>
            <Badge ok={props.payoutsEnabled} label="Utbetalningar aktiva" />
          </li>
        </ul>
      ) : (
        <div className={styles.empty}>
          <strong>Inget Stripe-konto kopplat ännu.</strong>
          Koppla Stripe för att kunna ta betalt online vid bokning.
        </div>
      )}

      <div className={styles.actions} style={{ marginTop: '1rem' }}>
        <form action={onboardAction}>
          <button type="submit" className="btn-primary" disabled={onboarding}>
            {onboarding
              ? 'Öppnar Stripe…'
              : props.chargesEnabled
                ? 'Hantera Stripe-konto'
                : props.hasAccount
                  ? 'Fortsätt onboarding'
                  : 'Koppla Stripe'}
          </button>
        </form>

        {props.hasAccount ? (
          <form action={refreshAction} ref={refreshRef}>
            <button type="submit" className={styles.btn} disabled={refreshing}>
              {refreshing ? 'Uppdaterar…' : 'Uppdatera status'}
            </button>
          </form>
        ) : null}
      </div>

      {/* Master-toggle: bara aktiverbar när kortbetalning är aktiv. */}
      <form action={toggleAction} className={styles.actions} style={{ marginTop: '1rem' }}>
        <input type="hidden" name="payments_enabled" value={(!props.paymentsEnabled).toString()} />
        <button
          type="submit"
          className={styles.btn}
          disabled={toggling || (!props.paymentsEnabled && !props.chargesEnabled)}
          title={
            !props.chargesEnabled ? 'Slutför Stripe-onboarding först' : undefined
          }
        >
          {toggling
            ? 'Uppdaterar…'
            : props.paymentsEnabled
              ? 'Stäng av onlinebetalning vid bokning'
              : 'Slå på onlinebetalning vid bokning'}
        </button>
        <span className={`${styles.statusTag} ${props.paymentsEnabled ? styles.statusTagOn : styles.statusTagOff}`}>
          Onlinebetalning: {props.paymentsEnabled ? 'PÅ' : 'AV'}
        </span>
      </form>

      {feedback ? (
        <p
          className={`${styles.feedback} ${(refreshState.success || toggleState.success) && !onboardState.error && !refreshState.error && !toggleState.error ? styles.feedbackOk : 'auth-error'}`}
          role="status"
          style={{ marginTop: '0.75rem' }}
        >
          {feedback}
        </p>
      ) : null}
    </div>
  )
}
