'use client'

import { useActionState, useEffect, useRef } from 'react'
import {
  startStripeOnboarding,
  refreshStripeStatus,
  setPaymentsEnabled,
  type StripeActionState,
} from '@/lib/admin/stripe'
import { Card, Callout, Badge } from '@/components/portal/ui'
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

/**
 * Betalning-kortet (goal-17 §6 — mockens andra kärnkort, folded inline). EN lean
 * Card: h2 "Betalning" + den LIVE wired "Betalning vid bokning"-toggeln
 * (setPaymentsEnabled → payments_enabled), amber sköld-band, och en kompakt
 * Stripe-anslutningsrad. Alla shippade actions behålls (onboarding/uppdatera/
 * slå på-av). Ingen egen kort-chrome, ingen andra h2 — speglar mockens Betalning-
 * Card-grammatik (toggle med AKTIV/AV-pill + proof-callout + statusrad).
 */
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

  // The live "Betalning vid bokning"-toggle: submits setPaymentsEnabled on change.
  // Gated DISABLED until Stripe charges are enabled (honest "can't enable yet"),
  // so it is never a dead toggle — it is the real wired payments_enabled control.
  const toggleRef = useRef<HTMLFormElement>(null)
  const canToggle = props.paymentsEnabled || props.chargesEnabled

  const feedback =
    onboardState.error ||
    refreshState.error ||
    toggleState.error ||
    refreshState.success ||
    toggleState.success
  const feedbackOk =
    (refreshState.success || toggleState.success) &&
    !onboardState.error &&
    !refreshState.error &&
    !toggleState.error

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
      <h2 className="h2" style={{ margin: 0 }}>
        Betalning
      </h2>

      {/* ── Live-toggle: Betalning vid bokning (= payments_enabled) ── */}
      <form action={toggleAction} ref={toggleRef}>
        <input type="hidden" name="payments_enabled" value={(!props.paymentsEnabled).toString()} />
        <label className="pswitch-row" style={{ cursor: canToggle ? 'pointer' : 'default' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                fontSize: '0.92rem',
              }}
            >
              Betalning vid bokning
              {props.paymentsEnabled ? (
                <span className="ppill ppill--on">Aktiv</span>
              ) : (
                <span className="ppill ppill--off">Av</span>
              )}
            </span>
            <span style={{ opacity: 0.72, fontSize: '0.9rem' }}>
              {canToggle
                ? 'Kunden betalar online när tiden bokas — pengarna går rakt till din salong.'
                : 'Koppla Stripe och slutför onboarding nedan för att kunna ta betalt vid bokning.'}
            </span>
          </span>
          <input
            className="pswitch"
            type="checkbox"
            checked={props.paymentsEnabled}
            disabled={toggling || !canToggle}
            onChange={() => toggleRef.current?.requestSubmit()}
            aria-label="Betalning vid bokning"
          />
        </label>
      </form>

      {/* No-show-skydd (mockens amber sköld). Visas medan betalning vid bokning är på. */}
      {props.paymentsEnabled ? (
        <Callout tone="warning" icon="shield">
          Skydd: en sen kund eller no-show markeras aldrig automatiskt som klar + betald.
        </Callout>
      ) : null}

      {/* ── Stripe-anslutningsrad (mockens "S · Stripe"-rad, inline) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          paddingTop: '0.85rem',
          borderTop: '1px solid var(--c-line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#635BFF',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              flex: 'none',
            }}
          >
            S
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.92rem' }}>Stripe</span>
            <span style={{ display: 'block', fontSize: '0.82rem', opacity: 0.72 }}>
              {props.chargesEnabled
                ? 'Ansluten · utbetalning till din salong'
                : props.hasAccount
                  ? 'Konto kopplat · slutför onboarding'
                  : 'Inget konto kopplat ännu'}
            </span>
          </span>
        </div>
        <Badge tone={props.chargesEnabled ? 'success' : props.hasAccount ? 'warning' : 'neutral'}>
          {props.chargesEnabled ? 'Ansluten' : props.hasAccount ? 'Påbörjad' : 'Ej kopplad'}
        </Badge>
      </div>

      {/* ── Anslutnings-status (radstatus, bara när konto finns) ── */}
      {props.hasAccount ? (
        <ul className={styles.stripeStatus}>
          <li>
            <span
              className={`${styles.statePill} ${props.detailsSubmitted ? styles.statePillOn : styles.statePillOff}`}
            >
              {props.detailsSubmitted ? '✓' : '•'} Uppgifter inskickade
            </span>
          </li>
          <li>
            <span
              className={`${styles.statePill} ${props.chargesEnabled ? styles.statePillOn : styles.statePillOff}`}
            >
              {props.chargesEnabled ? '✓' : '•'} Kortbetalning aktiv
            </span>
          </li>
          <li>
            <span
              className={`${styles.statePill} ${props.payoutsEnabled ? styles.statePillOn : styles.statePillOff}`}
            >
              {props.payoutsEnabled ? '✓' : '•'} Utbetalningar aktiva
            </span>
          </li>
        </ul>
      ) : null}

      {/* ── Shippade actions: koppla/hantera + uppdatera status ── */}
      <div className={styles.actions}>
        <form action={onboardAction}>
          <button type="submit" className={styles.btn} disabled={onboarding}>
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

      {feedback ? (
        <p
          className={`${styles.feedback} ${feedbackOk ? styles.feedbackOk : 'auth-error'}`}
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </Card>
  )
}
