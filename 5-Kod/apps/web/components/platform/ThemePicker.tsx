'use client'

import { useActionState, useEffect, useState } from 'react'
import { setTenantTheme, type ActionState } from '@/lib/platform/actions'
import { THEME_PALETTES } from '@/lib/platform/theme-palettes'
import { ThemeGallery } from './ThemeGallery'
import styles from './platform.module.css'

export type ThemeCopyMode = 'keep' | 'template'

/**
 * Kundkortets mallväljare (Sida-fliken). Själva galleriet — kategori-flikar, taggar,
 * sök, kort med mallens hero-bild — bor i ThemeGallery och delas med onboarding-studions
 * tema-steg, så de två ytorna aldrig glider isär.
 *
 * Beteende oförändrat: klick = FÖRHANDSVISAR i previewen (ingen spar); Publicera-raden
 * lägger mallen live (setTenantTheme).
 */
export function ThemePicker({
  tenantId,
  current,
  onPreview,
  onPublished,
}: {
  tenantId: string
  current: string
  /** Förhandsvisa en mall i previewen (ingen spar). */
  onPreview?: (theme: string, copyMode: ThemeCopyMode) => void
  /** Efter lyckad publicering (mallen ligger nu live). */
  onPublished?: () => void
}) {
  const [selected, setSelected] = useState(current)
  const [copyMode, setCopyMode] = useState<ThemeCopyMode | null>(null)
  // När den SPARADE mallen ändras (efter publicering + revalidate) → synka valet.
  useEffect(() => {
    setSelected(current)
    setCopyMode(null)
  }, [current])

  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await setTenantTheme(prev, fd)
    if (res.success) onPublished?.()
    return res
  }, {})

  const previewing = selected !== current
  const selName = THEME_PALETTES.find((t) => t.key === selected)?.name ?? selected

  function pick(key: string) {
    setSelected(key)
    setCopyMode(null)
    // Previewen behöver ett tillfälligt läge innan operatören väljer. Behåll är
    // den säkra förhandsvisningen, men inget skickas vid publicering förrän ett
    // av radiovalet faktiskt har gjorts.
    onPreview?.(key, 'keep')
  }

  function chooseCopyMode(next: ThemeCopyMode) {
    setCopyMode(next)
    onPreview?.(selected, next)
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="theme" value={selected} />

      <ThemeGallery value={selected} currentKey={current} onChange={pick} />

      {previewing ? (
        <div className={styles.dirtyRow} style={{ marginTop: 14, flexWrap: 'wrap' }} role="status">
          <span className={styles.dirtyDot} aria-hidden="true" />
          Förhandsvisar <strong>{selName}</strong> — ännu ej live.
          <fieldset style={{ display: 'flex', gap: 12, margin: 0, padding: 0, border: 0 }}>
            <legend className="sr-only">Innehåll vid mallbyte</legend>
            <label>
              <input
                type="radio"
                name="copyMode"
                value="keep"
                checked={copyMode === 'keep'}
                onChange={() => chooseCopyMode('keep')}
              />{' '}
              Behåll nuvarande innehåll
            </label>
            <label>
              <input
                type="radio"
                name="copyMode"
                value="template"
                checked={copyMode === 'template'}
                onChange={() => chooseCopyMode('template')}
              />{' '}
              Använd mallens innehåll
            </label>
          </fieldset>
          <span style={{ display: 'inline-flex', gap: 8, marginLeft: 'auto' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={pending || copyMode === null}
            >
              {pending ? 'Publicerar…' : `Publicera ${selName}`}
            </button>
            <button type="button" className={styles.btn} disabled={pending} onClick={() => pick(current)}>
              Avbryt
            </button>
          </span>
        </div>
      ) : null}

      {state.error ? (
        <div className={styles.actions} style={{ marginTop: 10 }}>
          <span className={`${styles.feedback} auth-error`} role="alert">{state.error}</span>
        </div>
      ) : null}
      {state.success ? (
        <div className={styles.actions} style={{ marginTop: 10 }}>
          <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">{state.success}</span>
        </div>
      ) : null}
    </form>
  )
}
