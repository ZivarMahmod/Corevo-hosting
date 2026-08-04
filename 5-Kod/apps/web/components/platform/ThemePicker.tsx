'use client'

import { useActionState, useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { setTenantTheme } from '@/lib/platform/actions/theme'
import type { ActionState } from '@/lib/platform/actions/shared'
import { THEME_PALETTES } from '@/lib/platform/theme-palettes'
import { themeContentCompatibility } from '@/lib/platform/theme-capabilities'
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
  onPublishingChange,
  contentSlotKeys = [],
  additionalThemeKeys = [],
}: {
  tenantId: string
  current: string
  /** Förhandsvisa en mall i previewen (ingen spar). */
  onPreview?: (theme: string, copyMode: ThemeCopyMode) => void
  /** Efter lyckad publicering (mallen ligger nu live). */
  onPublished?: () => void
  /** Hela publiceringslivscykeln, så den gemensamma editorn kan låsa alla mutationer. */
  onPublishingChange?: (pending: boolean) => void
  contentSlotKeys?: readonly string[]
  additionalThemeKeys?: readonly string[]
}) {
  const [selected, setSelected] = useState(current)
  const [copyMode, setCopyMode] = useState<ThemeCopyMode | null>(null)
  const publishingRef = useRef(false)
  const awaitingThemeRef = useRef<string | null>(null)
  const currentRef = useRef(current)
  const mountedRef = useRef(true)
  const onPublishingChangeRef = useRef(onPublishingChange)
  currentRef.current = current

  const beginPublishing = useCallback(() => {
    if (publishingRef.current) return
    publishingRef.current = true
    onPublishingChangeRef.current?.(true)
  }, [])

  const finishPublishing = useCallback(() => {
    awaitingThemeRef.current = null
    if (!publishingRef.current) return
    publishingRef.current = false
    if (mountedRef.current) onPublishingChangeRef.current?.(false)
  }, [])

  useEffect(() => {
    onPublishingChangeRef.current = onPublishingChange
  }, [onPublishingChange])
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      awaitingThemeRef.current = null
      if (publishingRef.current) {
        publishingRef.current = false
        onPublishingChangeRef.current?.(false)
      }
    }
  }, [])
  // När den SPARADE mallen ändras (efter publicering + revalidate) → synka valet.
  useEffect(() => {
    setSelected(current)
    setCopyMode(null)
    if (awaitingThemeRef.current === current) finishPublishing()
  }, [current, finishPublishing])

  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    // Native onSubmit announces synchronously before React schedules the action.
    // Direct/programmatic action calls still get the same lock through this fallback.
    beginPublishing()
    const targetTheme = String(fd.get('theme') ?? '')
    try {
      const res = await setTenantTheme(prev, fd)
      if (res.success) {
        awaitingThemeRef.current = targetTheme
        onPublished?.()
        // Normally router.refresh remounts the keyed studio. This also handles a
        // caller that already supplied the refreshed theme without a remount.
        if (currentRef.current === targetTheme) finishPublishing()
      } else {
        finishPublishing()
      }
      return res
    } catch (error) {
      finishPublishing()
      throw error
    }
  }, {})

  const previewing = selected !== current
  const selName = THEME_PALETTES.find((t) => t.key === selected)?.name ?? selected
  const hiddenContent = previewing
    ? themeContentCompatibility(current, selected, contentSlotKeys)
    : []

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // The ref makes a second submit in the same event turn a no-op and closes
    // the gap before useActionState starts its asynchronous reducer.
    if (publishingRef.current) {
      event.preventDefault()
      return
    }
    beginPublishing()
  }

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="theme" value={selected} />

      <ThemeGallery
        value={selected}
        currentKey={current}
        onChange={pick}
        additionalThemeKeys={additionalThemeKeys}
      />

      {previewing ? (
        <div className={styles.dirtyRow} style={{ marginTop: 14, flexWrap: 'wrap' }} role="status">
          <span className={styles.dirtyDot} aria-hidden="true" />
          Förhandsvisar <strong>{selName}</strong> — ännu ej live.
          <span style={{ width: '100%', lineHeight: 1.45 }}>
            <strong>Kontroll före mallbyte:</strong>{' '}
            {hiddenContent.length
              ? `${hiddenContent.join(', ')} visas inte i den valda mallen. Innehållet sparas och finns kvar om kunden byter tillbaka.`
              : 'Inga befintliga mallspecifika innehållsfält blir dolda.'}
          </span>
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
