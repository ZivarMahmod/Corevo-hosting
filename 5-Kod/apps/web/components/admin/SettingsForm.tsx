'use client'

import { useActionState, useState, type ReactNode } from 'react'
import { saveSettings, type ActionState } from '@/lib/admin/actions'
import { Card, Callout } from '@/components/portal/ui'
import styles from './admin.module.css'

const TIMEZONES = [
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Helsinki',
  'Europe/London',
  'UTC',
]

export type NotificationToggles = {
  confirmation: boolean
  reminder: boolean
  review: boolean
}

export type SettingsFormProps = {
  name: string
  paymentMode: string
  cancellationHours: number
  timezone: string
  locationName: string
  address: string
  contactEmail: string
  contactPhone: string
  customerAccountsEnabled: boolean
  /** Notiser & integritet — defaults match the "absent => on" reader semantics. */
  notifications?: NotificationToggles
  googleReviewUrl?: string
  cookieBannerEnabled?: boolean
}

/**
 * Presentational status pill (AKTIV / AV) reflecting a toggle's LIVE value. Driven
 * by the same React state that feeds the input's controlled echo, so it flips the
 * instant the owner toggles — playbook §6 "every toggle: AKTIV/AV-pill".
 */
function StatePill({ on }: { on: boolean }) {
  return on ? (
    <span className="ppill ppill--on">Aktiv</span>
  ) : (
    <span className="ppill ppill--off">Av</span>
  )
}

/**
 * One live toggle row (mock SalonSettings <Toggle> grammar). The input stays
 * UNCONTROLLED (defaultChecked) so the server-action submission is byte-identical
 * and `saveSettings` reads name/value unchanged — `onChange` only mirrors the value
 * into React state so the AKTIV/AV pill (and an optional proof Callout) react live.
 * Pass `proof` to render a consequence band that appears only while the toggle is on
 * (playbook §6 "proof-callout, no dead toggles").
 */
function LiveToggleRow({
  name,
  defaultOn,
  title,
  desc,
  proof,
  disabled,
}: {
  name: string
  defaultOn: boolean
  title: string
  desc: ReactNode
  /** Rendered (as a child of the form) only while the toggle is ON. */
  proof?: ReactNode
  disabled?: boolean
}) {
  const [on, setOn] = useState(defaultOn)
  return (
    <>
      <label className="pswitch-row">
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
            {title}
            {disabled ? <span className="ppill ppill--off">Kommer snart</span> : <StatePill on={on} />}
          </span>
          <span className={styles.muted}>{desc}</span>
        </span>
        <input
          className="pswitch"
          type="checkbox"
          name={name}
          value="true"
          defaultChecked={defaultOn}
          disabled={disabled}
          onChange={(e) => setOn(e.target.checked)}
        />
      </label>
      {proof && on && !disabled ? proof : null}
    </>
  )
}

export function SettingsForm({
  notifications = { confirmation: true, reminder: true, review: true },
  googleReviewUrl = '',
  cookieBannerEnabled = true,
  ...props
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveSettings, {})
  const tzOptions = TIMEZONES.includes(props.timezone) ? TIMEZONES : [props.timezone, ...TIMEZONES]

  return (
    <form
      action={formAction}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '40rem',
        margin: '1rem 0 1.75rem',
      }}
    >
      {/* ── Bokning ── salongsuppgifter + bokningsreglagen (mock: Card "Bokning") ── */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 className="h2" style={{ margin: 0 }}>
          Bokning
        </h2>

        <label className={styles.field}>
          <span>Salongsnamn</span>
          <input name="name" defaultValue={props.name} required />
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.field} style={{ flex: '1 1 12rem' }}>
            <span>E-post (kontakt)</span>
            <input name="contact_email" type="email" defaultValue={props.contactEmail} />
          </label>
          <label className={styles.field} style={{ flex: '1 1 10rem' }}>
            <span>Telefon</span>
            <input name="contact_phone" defaultValue={props.contactPhone} />
          </label>
        </div>

        <label className={styles.field}>
          <span>Adress</span>
          <input name="address" defaultValue={props.address} />
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.field} style={{ flex: '1 1 10rem' }}>
            <span>Platsnamn</span>
            <input name="location_name" defaultValue={props.locationName} />
          </label>
          <label className={styles.field} style={{ flex: '1 1 10rem' }}>
            <span>Tidszon</span>
            <select name="timezone" defaultValue={props.timezone}>
              {tzOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Bokningsbekräftelse — live green proof-Callout when ON. Mock claims
            "e-post + SMS testad", but actions.ts proves SMS was deliberately
            removed (ingen kopplad leverantör). E-post IS wired (booking@corevo.se),
            so the proof is e-post-only behaviour — never a fabricated SMS-QA claim. */}
        <LiveToggleRow
          name="notify_confirmation"
          defaultOn={notifications.confirmation}
          title="Bokningsbekräftelse"
          desc="Kunden får en bekräftelse direkt vid bokning."
          proof={
            <Callout tone="success" icon="check">
              Aktiv: kunden får en bokningsbekräftelse via e-post direkt vid bokning.
            </Callout>
          }
        />

        {/* G12: storefront customer accounts (login + "Mitt konto" + signup). */}
        <LiveToggleRow
          name="customer_accounts_enabled"
          defaultOn={props.customerAccountsEnabled}
          title="Kund-konton"
          desc="Visar inloggning + ”Mitt konto” på din publika sajt (annars endast gästbokning)."
        />

        {/* Drop-in synligt (mock gap) — there is no settings key for this yet, and the
            save path (lib/admin/actions.ts → saveSettings) is FROZEN, so a live toggle
            would silently fail to persist. Per "no dead toggles" it is rendered DISABLED
            with honest "kommer snart" copy. FLAGGED in the manifest notes for the orchestrator. */}
        <LiveToggleRow
          name="dropin_visible"
          defaultOn={false}
          disabled
          title="Drop-in synligt"
          desc="Visa ”Drop in eller boka online” i topp-baren på hemsidan. Kopplas på snart."
        />

        <label className={styles.field}>
          <span>Avbokning senast (timmar före)</span>
          <input
            name="cancellation_cutoff_hours"
            type="number"
            min="0"
            max="8760"
            defaultValue={props.cancellationHours}
            style={{ maxWidth: '10rem' }}
          />
        </label>
      </Card>

      {/* Betalningsläget styrs i dag av Stripe-kortet (payment_mode + Connect-kontot),
          inte av ett fält här. Den synliga "Betalning"-sektionen + Stripe-kopplingen
          bor i page.tsx (mockens Betalning-kort). Detta dolda fält bevarar bara det
          sparade payment_mode-värdet oförändrat när formuläret sparas batchat. */}
      <input type="hidden" name="payment_mode" value={props.paymentMode} />

      {/* ── Notiser & integritet ── shipped extras, behållna (additivt) ── */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 className="h2" style={{ margin: 0 }}>
          Notiser &amp; integritet
        </h2>

        {/* Provider-agnostisk formulering (ingen kopplad SMS-leverantör → påstå inte SMS). */}
        <LiveToggleRow
          name="notify_reminder"
          defaultOn={notifications.reminder}
          title="Påminnelse"
          desc="Skicka påminnelse inför bokad tid."
        />

        <LiveToggleRow
          name="notify_review"
          defaultOn={notifications.review}
          title="Recensions-förfrågan"
          desc="Skicka recensions-förfrågan efter besök."
        />

        <label className={styles.field}>
          <span>Google-recension-länk</span>
          <input
            name="google_review_url"
            type="url"
            placeholder="https://g.page/r/.../review"
            defaultValue={googleReviewUrl}
          />
          <span className={styles.muted}>
            Klistra in salongens Google-recensionslänk. Lämna tomt för att stänga av.
          </span>
        </label>

        {/* SMS-notiser borttaget (M6 §3.7 — inga döda toggles): ingen kopplad
            leverantör. saveSettings rör inte sms_enabled → ev. tidigare sparat
            värde bevaras orört via settings-mergen. */}

        <LiveToggleRow
          name="cookie_banner_enabled"
          defaultOn={cookieBannerEnabled}
          title="Cookie-banner"
          desc="Visa cookie-banner på din publika sajt."
        />
      </Card>

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara inställningar'}
        </button>
        {state.error ? (
          <span className={`${styles.feedback} auth-error`} role="alert">
            {state.error}
          </span>
        ) : null}
        {state.success ? (
          <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
            {state.success}
          </span>
        ) : null}
      </div>
    </form>
  )
}
