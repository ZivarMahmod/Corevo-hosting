'use client'

import { useActionState } from 'react'
import { saveSettings, type ActionState } from '@/lib/admin/actions'
import { Card } from '@/components/portal/ui'
import styles from './admin.module.css'

const TIMEZONES = [
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Helsinki',
  'Europe/London',
  'UTC',
]

const PAYMENT_MODES: { value: string; label: string }[] = [
  { value: 'on_site', label: 'Betala på plats' },
  { value: 'online', label: 'Betala online' },
  { value: 'both', label: 'Online + på plats' },
  { value: 'coming_soon', label: 'Online (kommer snart)' },
]

/** Left column of a .pswitch-row: stacks the title row over the muted description,
 *  so the toggle (the row's right child) is pushed to the far right. */
const SWITCH_TEXT_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.1rem',
  minWidth: 0,
} as const

/** Left side of a .pswitch-row: setting title + its AKTIV/AV status pill, inline. */
const SWITCH_LABEL_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontWeight: 600,
  fontSize: '0.92rem',
} as const

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
 * Presentational status pill (AKTIV / AV) reflecting a setting's CURRENT saved
 * value. Rendered from the same prop that feeds the input's `defaultChecked`, so
 * it shows the persisted state — it deliberately carries no client state and adds
 * no `onChange`, leaving the uncontrolled, server-wired input untouched.
 */
function StatePill({ on }: { on: boolean }) {
  return on ? (
    <span className="ppill ppill--on">Aktiv</span>
  ) : (
    <span className="ppill ppill--off">Av</span>
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
        gap: '1.25rem',
        maxWidth: '40rem',
        margin: '1rem 0 1.75rem',
      }}
    >
      {/* ── Bokning ── salongsuppgifter + kundkonton + avbokningsregel ── */}
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

        {/* G12: storefront customer accounts (login + "Mitt konto" + signup). Off = guest booking only. */}
        <label className="pswitch-row">
          <span style={SWITCH_TEXT_STYLE}>
            <span style={SWITCH_LABEL_STYLE}>
              Kund-konton
              <StatePill on={props.customerAccountsEnabled} />
            </span>
            <span className={styles.muted}>
              Visar inloggning + “Mitt konto” på din publika sajt (annars endast gästbokning).
            </span>
          </span>
          <input
            className="pswitch"
            type="checkbox"
            name="customer_accounts_enabled"
            value="true"
            defaultChecked={props.customerAccountsEnabled}
          />
        </label>

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

      {/* ── Betalning ── online-betalning styrs av Stripe-kortet nedan ── */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 className="h2" style={{ margin: 0 }}>
          Betalning
        </h2>

        <label className={styles.field} style={{ maxWidth: '20rem' }}>
          <span>Betalning · Kommer snart</span>
          {/* Online-betalning styrs i dag av Stripe-kortet nedan (payments_enabled +
              Connect-kontot), inte av det här läget — så kontrollen är avstängd tills
              den kopplas på. Hidden input bevarar sparat värde oförändrat vid spara. */}
          <input type="hidden" name="payment_mode" value={props.paymentMode} />
          <select defaultValue={props.paymentMode} disabled aria-disabled="true">
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <span className={styles.muted}>
            Online-betalning aktiveras via Stripe-kopplingen nedan.
          </span>
        </label>
      </Card>

      {/* ── Notiser & integritet ── toggles read by M9 + the storefront cookie-banner ── */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 className="h2" style={{ margin: 0 }}>
          Notiser &amp; integritet
        </h2>

        <label className="pswitch-row">
          <span style={SWITCH_TEXT_STYLE}>
            <span style={SWITCH_LABEL_STYLE}>
              Bokningsbekräftelse
              <StatePill on={notifications.confirmation} />
            </span>
            <span className={styles.muted}>Skicka bokningsbekräftelse till kunden.</span>
          </span>
          <input
            className="pswitch"
            type="checkbox"
            name="notify_confirmation"
            value="true"
            defaultChecked={notifications.confirmation}
          />
        </label>

        <label className="pswitch-row">
          <span style={SWITCH_TEXT_STYLE}>
            <span style={SWITCH_LABEL_STYLE}>
              Påminnelse
              <StatePill on={notifications.reminder} />
            </span>
            <span className={styles.muted}>Skicka påminnelse inför bokad tid.</span>
          </span>
          <input
            className="pswitch"
            type="checkbox"
            name="notify_reminder"
            value="true"
            defaultChecked={notifications.reminder}
          />
        </label>

        <label className="pswitch-row">
          <span style={SWITCH_TEXT_STYLE}>
            <span style={SWITCH_LABEL_STYLE}>
              Recensions-förfrågan
              <StatePill on={notifications.review} />
            </span>
            <span className={styles.muted}>Skicka recensions-förfrågan efter besök.</span>
          </span>
          <input
            className="pswitch"
            type="checkbox"
            name="notify_review"
            value="true"
            defaultChecked={notifications.review}
          />
        </label>

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

        {/* SMS-notiser borttaget (M6 §3.7 — inga döda toggles): det fanns ingen
            kopplad leverantör, så kontrollen gjorde inget. Återinförs när en
            SMS-leverantör är kopplad. saveSettings rör inte sms_enabled längre →
            ev. tidigare sparat värde bevaras orört via settings-mergen. */}

        <label className="pswitch-row">
          <span style={SWITCH_TEXT_STYLE}>
            <span style={SWITCH_LABEL_STYLE}>
              Cookie-banner
              <StatePill on={cookieBannerEnabled} />
            </span>
            <span className={styles.muted}>Visa cookie-banner på din publika sajt.</span>
          </span>
          <input
            className="pswitch"
            type="checkbox"
            name="cookie_banner_enabled"
            value="true"
            defaultChecked={cookieBannerEnabled}
          />
        </label>
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
