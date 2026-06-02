'use client'

import { useActionState } from 'react'
import { saveSettings, type ActionState } from '@/lib/admin/actions'
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

export function SettingsForm({
  notifications = { confirmation: true, reminder: true, review: true },
  googleReviewUrl = '',
  cookieBannerEnabled = true,
  ...props
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveSettings, {})
  const tzOptions = TIMEZONES.includes(props.timezone) ? TIMEZONES : [props.timezone, ...TIMEZONES]

  return (
    <form action={formAction} className={`${styles.form} ${styles.formStacked}`}>
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

      <div className={styles.fieldRow}>
        <label className={styles.field} style={{ flex: '1 1 12rem' }}>
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
        <label className={styles.field} style={{ flex: '1 1 12rem' }}>
          <span>Avbokning senast (timmar före)</span>
          <input
            name="cancellation_cutoff_hours"
            type="number"
            min="0"
            max="8760"
            defaultValue={props.cancellationHours}
          />
        </label>
      </div>

      {/* G12: storefront customer accounts (login + "Mitt konto" + signup). Off = guest booking only. */}
      <label className={styles.check}>
        <input
          type="checkbox"
          name="customer_accounts_enabled"
          value="true"
          defaultChecked={props.customerAccountsEnabled}
        />
        Tillåt kundkonton — visar inloggning + “Mitt konto” på din publika sajt (annars endast
        gästbokning)
      </label>

      {/* Notiser & integritet — toggles read by M9 (notifications) + the storefront
          cookie-banner. Lives inside the same form so it saves with everything else. */}
      <div className={styles.sectionHead} style={{ marginTop: '1rem' }}>
        <h2 style={{ fontSize: '1.05rem' }}>Notiser &amp; integritet</h2>
      </div>

      <div className={styles.checks} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="notify_confirmation"
            value="true"
            defaultChecked={notifications.confirmation}
          />
          Skicka bokningsbekräftelse
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="notify_reminder"
            value="true"
            defaultChecked={notifications.reminder}
          />
          Skicka påminnelse
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="notify_review"
            value="true"
            defaultChecked={notifications.review}
          />
          Skicka recensions-förfrågan efter besök
        </label>
      </div>

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

      <label className={styles.check}>
        <input
          type="checkbox"
          name="cookie_banner_enabled"
          value="true"
          defaultChecked={cookieBannerEnabled}
        />
        Visa cookie-banner på sajten
      </label>

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
