'use client'

import { useActionState } from 'react'
import { saveTenantContact, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Publik kontakt (e-post + telefon → settings.contact) + adress (primär location) +
 * sociala medier (settings.social) för en vald salong — redigeras från super-admin,
 * syns på Kontakt-sidan och i footern. Adressen geokodas best-effort vid spar
 * (settings.map) → kart-embedden på Kontakt-sidan. Öppettider har eget kort.
 */
export function TenantContactForm({
  tenantId,
  email,
  phone,
  address,
  social,
  onSaved,
  onFlash,
}: {
  tenantId: string
  email: string | null
  phone: string | null
  address: string | null
  social?: { instagram: string; facebook: string; tiktok: string }
  onSaved?: () => void
  /** "Visa var": blinkar värdet i previewen. */
  onFlash?: (text: string) => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (p, fd) => {
      const r = await saveTenantContact(p, fd)
      if (r.success) onSaved?.()
      return r
    },
    {},
  )
  const flashBtn = (text: string | null) =>
    onFlash && text ? (
      <button
        type="button"
        className={styles.btn}
        style={{ padding: '2px 8px', fontSize: 11, marginLeft: 'auto' }}
        onClick={() => onFlash(text)}
        title="Markerar var på sidan värdet syns"
      >
        Visa var
      </button>
    ) : null

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>E-post {flashBtn(email)}</span>
          <input name="email" type="email" defaultValue={email ?? ''} placeholder="salong@exempel.se" />
        </label>
        <label className={styles.field}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Telefon {flashBtn(phone)}</span>
          <input name="phone" defaultValue={phone ?? ''} placeholder="013-12 34 56" />
        </label>
      </div>

      <label className={styles.field}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Adress {flashBtn(address)}</span>
        <input name="address" defaultValue={address ?? ''} placeholder="Storgatan 1, 582 22 Linköping" />
        <span className={styles.hint}>
          Kartan på Kontakt-sidan pekar på den här adressen (slås upp automatiskt när du sparar).
        </span>
      </label>

      <p className={styles.groupTitle} style={{ padding: 0, marginBottom: -4 }}>
        Sociala medier
      </p>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        Länkarna visas under &quot;Följ oss&quot; på Kontakt-sidan och som ikoner i sidfoten. Tomt fält = visas inte.
      </p>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Instagram</span>
          <input name="instagram" defaultValue={social?.instagram ?? ''} placeholder="instagram.com/salongen" autoCapitalize="none" spellCheck={false} />
        </label>
        <label className={styles.field}>
          <span>Facebook</span>
          <input name="facebook" defaultValue={social?.facebook ?? ''} placeholder="facebook.com/salongen" autoCapitalize="none" spellCheck={false} />
        </label>
        <label className={styles.field}>
          <span>TikTok</span>
          <input name="tiktok" defaultValue={social?.tiktok ?? ''} placeholder="tiktok.com/@salongen" autoCapitalize="none" spellCheck={false} />
        </label>
      </div>

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara kontakt'}
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
