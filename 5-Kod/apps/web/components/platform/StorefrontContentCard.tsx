'use client'

import { useActionState, useState } from 'react'
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
  defaults = [],
  onFlashImage,
}: {
  tenantId: string
  slot: 'hero' | 'gallery'
  label: string
  hint: string
  images: string[]
  /** Mallens standardbilder — visas som thumbnails när inga egna finns (Zivar:
   *  "jag vill se alla deras bilder framme så jag vet vilka bilder det är"). */
  defaults?: string[]
  /** "Visa var": markera bilden i previewen (scrollar dit och blinkar). */
  onFlashImage?: (url: string) => void
}) {
  const [upState, upAction, upPending] = useActionState<ActionState, FormData>(
    uploadTenantStorefrontImage,
    {},
  )
  const usingDefaults = images.length === 0 && defaults.length > 0

  return (
    <div className={styles.form}>
      <p className={styles.groupTitle} style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        {label} · {usingDefaults ? defaults.length : images.length}
        <span style={usingDefaults || images.length === 0 ? thumbChipDef : thumbChipOwn}>
          {usingDefaults || images.length === 0 ? 'Mallens standard' : 'Egna bilder'}
        </span>
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

      {/* Mallens standardbilder: DET är de här som faktiskt syns på sidan just nu —
          visas så operatören vet exakt vilken bild hen byter ut. Kan inte tas bort
          (de ägs av mallen); ladda upp egna för att ersätta hela setet. */}
      {usingDefaults && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.6rem' }}>
          {defaults.map((url) => (
            <div key={url} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: 120 }}>
              {/* Plain <img> — remote-image config is frozen (never next/image). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px dashed var(--c-line-strong, #d3dacd)', opacity: 0.92 }}
              />
              {onFlashImage ? (
                <button type="button" className={styles.btn} style={{ width: '100%' }} onClick={() => onFlashImage(url)} title="Markerar var på sidan bilden syns">
                  Visa var
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Upload one image — separate form (one-form-one-action). */}
      <form action={upAction}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="slot" value={slot} />
        <label className={styles.field}>
          <span>Ladda upp bild (PNG/JPG/WEBP, max 8 MB)</span>
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
  // Tvåstegsbekräftelse (samma mönster som ServicesManager/StaffRoster): bilden låg ETT
  // klick från att raderas ur R2 (ingen ångra). Klick 1 armerar (knappen blir "Säker? Ta
  // bort permanent" + en Ångra), klick 2 skickar formuläret. Egen state per thumbnail.
  const [armed, setArmed] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: 120 }}>
      {/* Plain <img> — remote-image config is frozen (never next/image). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="slot" value={slot} />
        <input type="hidden" name="url" value={url} />
        {armed ? (
          <>
            <button
              type="submit"
              className={styles.btnDanger}
              disabled={pending}
              style={{ width: '100%' }}
            >
              {pending ? 'Tar bort…' : 'Säker? Ta bort permanent'}
            </button>
            <button
              type="button"
              className={styles.btn}
              disabled={pending}
              style={{ width: '100%' }}
              onClick={() => setArmed(false)}
            >
              Ångra
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.btnDanger}
            style={{ width: '100%' }}
            onClick={() => setArmed(true)}
          >
            Ta bort
          </button>
        )}
      </form>
      {/* Kvitto: både fel OCH "Bild borttagen…" (tidigare visades bara fel — en lyckad
          radering gav ingen bekräftelse alls). */}
      <Feedback state={state} />
    </div>
  )
}

const thumbChipDef = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
  color: 'var(--c-ink-3)',
  background: 'var(--c-paper-2)',
  border: '1px solid var(--c-line)',
  padding: '1px 6px',
  borderRadius: 999,
}
const thumbChipOwn = {
  ...thumbChipDef,
  color: 'var(--c-gold-600, #9c6f1f)',
  background: 'var(--c-gold-100, #f0e6ce)',
  border: '1px solid transparent',
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
