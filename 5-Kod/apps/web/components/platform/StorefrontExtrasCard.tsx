'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { saveTenantSingleImage, saveTenantStats, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Rikare-tema-media: about-bild + closing-bild (enkla bild-slots) + fakta/statistik.
 * Används av de RIKARE mallarna (Salvia m.fl.) — INTE FreshCut. Skriver branding-jsonb.
 *
 * Fakta följer samma modell som texten (Zivar: "och denna"): raderna FÖRIFYLLS med
 * mallens standardfakta när inga egna finns, kortet visar "Mallens standard"/"Egna
 * fakta", "↩ Använd mallens fakta" återgår, och "Visa var" markerar raden i previewen.
 * OBS ordning: branding.stats = [värde, etikett] (ThemeStat) — mallarna renderar
 * värdet stort och etiketten under.
 */
export function SingleImageSlot({
  tenantId,
  slot,
  label,
  url,
  onFlashImage,
  onSaved,
}: {
  tenantId: string
  slot: 'about' | 'closing'
  label: string
  url: string | null
  onFlashImage?: (url: string) => void
  onSaved?: () => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await saveTenantSingleImage(prev, fd)
    if (res.success) onSaved?.()
    return res
  }, {})

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
          {onFlashImage ? (
            <button
              type="button"
              className={styles.btn}
              onClick={() => onFlashImage(url)}
              title="Markerar var på sidan bilden syns (scrollar dit och blinkar)"
            >
              Visa var
            </button>
          ) : null}
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
        <span className={styles.muted}>Ingen bild — mallens standard visas.</span>
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

type StatRow = { value: string; label: string }

export function StatsCard({
  tenantId,
  stats,
  statsDefaults,
  onFlashText,
  onSaved,
}: {
  tenantId: string
  stats: [string, string][]
  statsDefaults: [string, string][]
  onFlashText?: (text: string) => void
  onSaved?: () => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await saveTenantStats(prev, fd)
    if (res.success) onSaved?.()
    return res
  }, {})
  const N = 4
  const toRows = (list: [string, string][]): StatRow[] =>
    Array.from({ length: N }, (_, i) => ({ value: list[i]?.[0] ?? '', label: list[i]?.[1] ?? '' }))

  const defaults = useMemo(() => toRows(statsDefaults), [JSON.stringify(statsDefaults)]) // eslint-disable-line react-hooks/exhaustive-deps
  // Effektiva rader: egna om satta, annars mallens standard — förifyllt, aldrig tomt+placeholder.
  const initial = useMemo(
    () => (stats.length ? toRows(stats) : defaults),
    [JSON.stringify(stats), defaults], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [rows, setRows] = useState<StatRow[]>(initial)
  useEffect(() => setRows(initial), [initial])

  const sameAsDefault = rows.every(
    (r, i) => r.value === (defaults[i]?.value ?? '') && r.label === (defaults[i]?.label ?? ''),
  )
  const dirty = rows.some((r, i) => r.value !== (initial[i]?.value ?? '') || r.label !== (initial[i]?.label ?? ''))

  const set = (i: number, key: keyof StatRow, v: string) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: v } : r)))

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      {/* Identiskt med mallens standard → spara TOM lista (= ingen override, mallens
          fakta fortsätter gälla och kan uppdateras med mallen). */}
      {rows.map((r, i) => (
        <span key={i}>
          <input type="hidden" name={`stat_value_${i}`} value={sameAsDefault ? '' : r.value} />
          <input type="hidden" name={`stat_label_${i}`} value={sameAsDefault ? '' : r.label} />
        </span>
      ))}

      <p className={styles.groupTitle} style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        Fakta / statistik
        <span style={sameAsDefault ? chipDefault : chipOwn}>{sameAsDefault ? 'Mallens standard' : 'Egna fakta'}</span>
        {!sameAsDefault ? (
          <button type="button" style={miniBtn} onClick={() => setRows(defaults)} title="Återgå till mallens standardfakta">
            ↩ Använd mallens fakta
          </button>
        ) : null}
      </p>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        Siffer-fakta på Om oss-sektionen — <strong>Värde</strong> visas stort (t.ex. &quot;2 000+&quot;),{' '}
        <strong>Etikett</strong> under (t.ex. &quot;Nöjda kunder&quot;). Tomma rader hoppas över.
      </p>
      {rows.map((r, i) => (
        <div key={i} className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Värde {i + 1}</span>
            <input value={r.value} onChange={(e) => set(i, 'value', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Etikett {i + 1}
              {onFlashText && (r.label || r.value) ? (
                <button
                  type="button"
                  style={miniBtn}
                  onClick={() => onFlashText(r.label || r.value)}
                  title="Markerar var på sidan den här fakta-raden syns"
                >
                  Visa var
                </button>
              ) : null}
            </span>
            <input value={r.label} onChange={(e) => set(i, 'label', e.target.value)} />
          </label>
        </div>
      ))}
      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending || !dirty}>
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

const chipDefault: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  color: 'var(--c-ink-3)',
  background: 'var(--c-paper-2)',
  border: '1px solid var(--c-line)',
  padding: '1px 6px',
  borderRadius: 999,
}
const chipOwn: CSSProperties = {
  ...chipDefault,
  color: 'var(--c-gold-600, #9c6f1f)',
  background: 'var(--c-gold-100, #f0e6ce)',
  border: '1px solid transparent',
}
const miniBtn: CSSProperties = {
  border: '1px solid var(--c-line-strong)',
  background: 'var(--c-paper-2)',
  color: 'var(--c-ink-2)',
  borderRadius: 5,
  padding: '2px 7px',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
}
