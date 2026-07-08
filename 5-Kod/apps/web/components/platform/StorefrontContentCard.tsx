'use client'

import { useActionState } from 'react'
import {
  uploadTenantStorefrontImage,
  removeTenantStorefrontImage,
  type ActionState,
} from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Super-admin storefront-BILDER (hero/galleri) för en VALD salong — Sida v4:
 * texten bor i CopyFieldsCard (per publik sida), bilderna här. One-form-one-action;
 * platform_admin-gatat i server-lagret. Plain <img> (remote next/image är fryst).
 */
// ── Bild-slot (hero / galleri) — thumbnails + remove + upload ─────────────────────
export function ImageSlotManager({
  tenantId,
  slot,
  label,
  hint,
  images,
  onFlashImage,
}: {
  tenantId: string
  slot: 'hero' | 'gallery'
  label: string
  hint: string
  images: string[]
  /** "Visa var": markera bilden i previewen (scrollar dit och blinkar). */
  onFlashImage?: (url: string) => void
}) {
  const [upState, upAction, upPending] = useActionState<ActionState, FormData>(
    uploadTenantStorefrontImage,
    {},
  )

  return (
    <div className={styles.form}>
      <p className={styles.groupTitle} style={{ padding: 0 }}>
        {label} · {images.length}
      </p>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        {hint}
      </p>

      {images.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.6rem' }}>
          {images.map((url) => (
            <ImageThumb key={url} tenantId={tenantId} slot={slot} url={url} onFlashImage={onFlashImage} />
          ))}
        </div>
      )}

      {/* Upload one image — separate form (one-form-one-action). */}
      <form action={upAction}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="slot" value={slot} />
        <label className={styles.field}>
          <span>Ladda upp bild (PNG/JPG/WEBP, max 2 MB)</span>
          <input type="file" name="image" accept="image/*" required />
        </label>
        <div className={styles.actions}>
          <button type="submit" className={styles.btn} disabled={upPending}>
            {upPending ? 'Laddar upp…' : 'Lägg till bild'}
          </button>
          <Feedback state={upState} />
        </div>
      </form>
    </div>
  )
}

function ImageThumb({
  tenantId,
  slot,
  url,
  onFlashImage,
}: {
  tenantId: string
  slot: 'hero' | 'gallery'
  url: string
  onFlashImage?: (url: string) => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    removeTenantStorefrontImage,
    {},
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: 120 }}>
      {/* Plain <img> — remote-image config is frozen (never next/image). */}
      <img
        src={url}
        alt=""
        style={{
          width: 120,
          height: 80,
          objectFit: 'cover',
          borderRadius: 6,
          border: '1px solid var(--c-line, #e5e2da)',
        }}
      />
      {onFlashImage ? (
        <button
          type="button"
          className={styles.btn}
          style={{ width: '100%' }}
          onClick={() => onFlashImage(url)}
          title="Markerar var på sidan bilden syns"
        >
          Visa var
        </button>
      ) : null}
      <form action={action}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="slot" value={slot} />
        <input type="hidden" name="url" value={url} />
        <button
          type="submit"
          className={styles.btnDanger}
          disabled={pending}
          style={{ width: '100%' }}
        >
          {pending ? 'Tar bort…' : 'Ta bort'}
        </button>
      </form>
      {state.error && (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </span>
      )}
    </div>
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
