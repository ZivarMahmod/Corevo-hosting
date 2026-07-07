'use client'

import { useActionState } from 'react'
import {
  saveTenantStorefrontCopy,
  uploadTenantStorefrontImage,
  removeTenantStorefrontImage,
  type ActionState,
} from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Super-admin storefront CONTENT for a CHOSEN salon (mounted in the Branding tab,
 * below PlatformBrandingForm — colours/logo there, editorial copy + hero/gallery
 * photos here). Lets the operator manage the customer's public storefront without
 * logging into the salon's own admin. One-form-one-action, mirroring ServicesCard/
 * PersonalCard; every action is platform_admin-gated in the server layer.
 *
 * Copy prefills from the STORED override (settings.copy) — blank when unset — so a
 * blank field keeps "faller tillbaka på temats standard"; clearing a field reverts
 * to the theme default. Images are plain <img> (the repo froze next/image for remote).
 */
type Copy = {
  heroEyebrow: string
  heroTitle: string
  heroLede: string
  aboutCopy: string
  tagline: string
  italic: string
}

export function StorefrontContentCard({
  tenantId,
  copy,
  heroImages,
  galleryImages,
}: {
  tenantId: string
  copy: Copy
  heroImages: string[]
  galleryImages: string[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <CopyForm tenantId={tenantId} copy={copy} />
      <ImageSlotManager
        tenantId={tenantId}
        slot="hero"
        label="Hero-bilder"
        hint="Bilderna högst upp på salongens sida. Läggs till en i taget; tom slot faller tillbaka på temats standardfoton."
        images={heroImages}
      />
      <ImageSlotManager
        tenantId={tenantId}
        slot="gallery"
        label="Galleri-bilder"
        hint="Bildgalleriet på salongens sida. Tom slot faller tillbaka på temats standardgalleri."
        images={galleryImages}
      />
    </div>
  )
}

// ── Editorial copy (settings.copy) ────────────────────────────────────────────────
function CopyForm({ tenantId, copy }: { tenantId: string; copy: Copy }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveTenantStorefrontCopy,
    {},
  )

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <p className={styles.groupTitle} style={{ padding: 0 }}>
        Storefront-text
      </p>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        Redigera salongens säljtext direkt härifrån. Lämna ett fält tomt för att falla
        tillbaka på temats standardtext. Slår igenom på den publika sidan direkt.
      </p>

      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Eyebrow (liten rubrik)</span>
          <input name="heroEyebrow" defaultValue={copy.heroEyebrow} placeholder="Temats standard" />
        </label>
        <label className={styles.field}>
          <span>Tagline</span>
          <input name="tagline" defaultValue={copy.tagline} placeholder="Temats standard" />
        </label>
      </div>

      <label className={styles.field}>
        <span>Hero-rubrik (radbrytning tillåten)</span>
        <textarea name="heroTitle" rows={2} defaultValue={copy.heroTitle} placeholder="Temats standard" />
      </label>

      <label className={styles.field}>
        <span>Hero-ingress</span>
        <textarea name="heroLede" rows={2} defaultValue={copy.heroLede} placeholder="Temats standard" />
      </label>

      <label className={styles.field}>
        <span>Om salongen</span>
        <textarea name="aboutCopy" rows={4} defaultValue={copy.aboutCopy} placeholder="Temats standard" />
      </label>

      <label className={styles.field}>
        <span>Kursiv fras (citat/värme)</span>
        <input name="italic" defaultValue={copy.italic} placeholder="Temats standard" />
      </label>

      <div className={styles.actions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? 'Sparar…' : 'Spara text'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

// ── Bild-slot (hero / galleri) — thumbnails + remove + upload ─────────────────────
function ImageSlotManager({
  tenantId,
  slot,
  label,
  hint,
  images,
}: {
  tenantId: string
  slot: 'hero' | 'gallery'
  label: string
  hint: string
  images: string[]
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
            <ImageThumb key={url} tenantId={tenantId} slot={slot} url={url} />
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
}: {
  tenantId: string
  slot: 'hero' | 'gallery'
  url: string
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
