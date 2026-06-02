'use client'

import { useActionState } from 'react'
import {
  saveTenantData,
  sendPasswordReset,
  createTenantStaff,
  type ActionState,
} from '@/lib/platform/actions'
import {
  BOOKING_VARIANTS,
  BOOKING_VARIANT_LABELS,
  BOOKING_VARIANT_DESCRIPTIONS,
  type BookingVariant,
} from '@/lib/platform/booking-variant'
import styles from './platform.module.css'

/**
 * §2.1B "Supabase med mitt UI" — Zivars no-code operativa data-kontroll för EN vald
 * salong. Tre strukturerade kort: redigera salongsdata (namn · recensionslänk ·
 * boknings-vy), lösenords-reset för salongsadmin, och Zivar-assisterad personal-
 * onboarding. Allt med laddar/fel/lyckat-läge.
 *
 * "Kund" här = SALONGEN (tenant) — Zivars kund. Detta är INTE slutkunds-CRUD
 * (kunddatabasen ägs av M6).
 */
export function OperativeControls({
  tenantId,
  name,
  googleReviewUrl,
  bookingVariant,
  salonAdminEmail,
  serviceRoleAvailable,
}: {
  tenantId: string
  name: string
  googleReviewUrl: string | null
  bookingVariant: BookingVariant
  salonAdminEmail: string | null
  serviceRoleAvailable: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <TenantDataForm
        tenantId={tenantId}
        name={name}
        googleReviewUrl={googleReviewUrl}
        bookingVariant={bookingVariant}
      />
      <PasswordResetForm
        tenantId={tenantId}
        salonAdminEmail={salonAdminEmail}
        serviceRoleAvailable={serviceRoleAvailable}
      />
      <StaffOnboardForm tenantId={tenantId} />
    </div>
  )
}

// ── Redigera salongsdata (namn · recensionslänk · boknings-vy) ──────────────────
function TenantDataForm({
  tenantId,
  name,
  googleReviewUrl,
  bookingVariant,
}: {
  tenantId: string
  name: string
  googleReviewUrl: string | null
  bookingVariant: BookingVariant
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveTenantData, {})

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <label className={styles.field}>
        <span>Salongsnamn</span>
        <input name="name" defaultValue={name} required />
        <span className={styles.hint}>
          Subdomänen kan inte ändras här (den är salongens live-adress).
        </span>
      </label>

      <label className={styles.field}>
        <span>Google-recensionslänk</span>
        <input
          name="google_review_url"
          type="url"
          defaultValue={googleReviewUrl ?? ''}
          placeholder="https://g.page/r/.../review"
          autoCapitalize="none"
          spellCheck={false}
        />
        <span className={styles.hint}>
          Skickas i recensions-nudgen efter ett klart besök. Tom = avstängd. Delas med
          salongens egen inställning.
        </span>
      </label>

      <fieldset className={styles.group} style={{ background: 'transparent' }}>
        <legend className={styles.groupTitle}>Boknings-vy</legend>
        <p className={styles.hint} style={{ marginTop: 0 }}>
          Konfigurerar vilken bokningsvy salongen ska ha. Valet sparas på salongen och
          aktiveras av bokningsmotorn när den läser inställningen. Skiljt från temamallen
          (startsidans utseende).
        </p>
        <div className={styles.templateGrid} role="radiogroup" aria-label="Boknings-vy">
          {BOOKING_VARIANTS.map((v) => (
            <label
              key={v}
              className={styles.templateCard}
              style={{ cursor: 'pointer' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <input
                  type="radio"
                  name="booking_variant"
                  value={v}
                  defaultChecked={v === bookingVariant}
                />
                <span className={styles.templateName}>{BOOKING_VARIANT_LABELS[v]}</span>
              </span>
              <span className={styles.templateDesc}>{BOOKING_VARIANT_DESCRIPTIONS[v]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara salongsdata'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

// ── Lösenords-reset för salongsadmin ────────────────────────────────────────────
function PasswordResetForm({
  tenantId,
  salonAdminEmail,
  serviceRoleAvailable,
}: {
  tenantId: string
  salonAdminEmail: string | null
  serviceRoleAvailable: boolean
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(sendPasswordReset, {})

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <p className={styles.groupTitle} style={{ padding: 0 }}>
        Lösenords-reset
      </p>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        Skapar en säker återställningslänk åt salongsadmin. Du får länken här att dela.
      </p>

      {!serviceRoleAvailable ? (
        <p className={styles.muted}>
          Kräver <code className={styles.code}>SUPABASE_SERVICE_ROLE_KEY</code> (sätts av ops).
          Tills den är satt går reset inte att köra.
        </p>
      ) : null}

      <label className={styles.field}>
        <span>E-post</span>
        <input
          name="email"
          type="email"
          defaultValue={salonAdminEmail ?? ''}
          placeholder="agare@salong.se"
          autoCapitalize="none"
          required
        />
        {!salonAdminEmail ? (
          <span className={styles.hint}>Ingen salongsadmin inbjuden ännu — ange e-post manuellt.</span>
        ) : null}
      </label>

      <div className={styles.actions}>
        <button type="submit" className={styles.btn} disabled={pending || !serviceRoleAvailable}>
          {pending ? 'Skapar länk…' : 'Skapa återställningslänk'}
        </button>
      </div>
      {state.error ? (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </span>
      ) : null}
      {state.success ? (
        <span className={`${styles.feedback} ${styles.feedbackPre} ${styles.feedbackOk}`} role="status">
          {state.success}
        </span>
      ) : null}
    </form>
  )
}

// ── Zivar-assisterad personal-onboarding ────────────────────────────────────────
function StaffOnboardForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTenantStaff, {})

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <p className={styles.groupTitle} style={{ padding: 0 }}>
        Lägg till personal
      </p>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        Onboarda personal åt salongen när de vill ha hjälp. Inga tvingande fält utöver
        namn/titel — fyll resten i salongsadmin senare.
      </p>

      <label className={styles.field}>
        <span>Namn / titel</span>
        <input name="title" placeholder="t.ex. Anna Svensson · Frisör" required />
      </label>

      <div className={styles.actions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? 'Lägger till…' : 'Lägg till medarbetare'}
        </button>
        <Feedback state={state} />
      </div>
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
