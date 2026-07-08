'use client'

import { useActionState } from 'react'
import { saveTenantSingleImage, saveTenantStats, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Rikare-tema-media: about-bild + closing-bild (enkla bild-slots) + statistik-par.
 * Används av de RIKARE mallarna (Salvia m.fl.) — INTE FreshCut. Skriver branding-jsonb.
 */
export function StorefrontExtrasCard({
  tenantId,
  aboutImage,
  closingImage,
  stats,
}: {
  tenantId: string
  aboutImage: string | null
  closingImage: string | null
  stats: [string, string][]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SingleImageSlot tenantId={tenantId} slot="about" label="Om-bild" url={aboutImage} />
      <SingleImageSlot tenantId={tenantId} slot="closing" label="Closing-bild" url={closingImage} />
      <StatsForm tenantId={tenantId} stats={stats} />
    </div>
  )
}

function SingleImageSlot({
  tenantId,
  slot,
  label,
  url,
}: {
  tenantId: string
  slot: 'about' | 'closing'
  label: string
  url: string | null
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTenantSingleImage, {})

  return (
    <div className={styles.form}>
      <p className={styles.groupTitle} style={{ padding: 0 }}>
        {label}
      </p>
      {url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Plain <img> — remote-image config is frozen (never next/image). */}
          <img
            src={url}
            alt=""
            style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--c-line, #e5e2da)' }}
          />
          <form action={action}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="slot" value={slot} />
            <input type="hidden" name="remove" value="true" />
            <button type="submit" className={styles.btnDanger} disabled={pending}>
              {pending ? 'Tar bort…' : 'Ta bort'}
            </button>
          </form>
        </div>
      ) : (
        <span className={styles.muted}>Ingen bild — temats standard visas.</span>
      )}

      <form action={action}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="slot" value={slot} />
        <label className={styles.field}>
          <span>Ladda upp bild (PNG/JPG/WEBP, max 2 MB)</span>
          <input type="file" name="image" accept="image/*" required />
        </label>
        <div className={styles.actions}>
          <button type="submit" className={styles.btn} disabled={pending}>
            {pending ? 'Sparar…' : 'Spara bild'}
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
    </div>
  )
}

function StatsForm({ tenantId, stats }: { tenantId: string; stats: [string, string][] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTenantStats, {})
  const rows = [0, 1, 2, 3]

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <p className={styles.groupTitle} style={{ padding: 0 }}>
        Fakta / statistik
      </p>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        T.ex. &quot;Nöjda kunder&quot; · &quot;2 000+&quot;. Tomma rader hoppas över.
      </p>
      {rows.map((i) => (
        <div key={i} className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Etikett {i + 1}</span>
            <input name={`stat_label_${i}`} defaultValue={stats[i]?.[0] ?? ''} placeholder="Nöjda kunder" />
          </label>
          <label className={styles.field}>
            <span>Värde {i + 1}</span>
            <input name={`stat_value_${i}`} defaultValue={stats[i]?.[1] ?? ''} placeholder="2 000+" />
          </label>
        </div>
      ))}
      <div className={styles.actions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? 'Sparar…' : 'Spara fakta'}
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
