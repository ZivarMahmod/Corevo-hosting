'use client'

import { useActionState, useEffect, useId, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { saveTenantStorefrontCopy, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Generiskt text-kort för Sida-flikens per-sida-redigering (Zivar: "texten som står
 * idag ska stå redan i rutan så jag vet exakt vilken jag ändrar").
 *
 * Varje fält visar den EFFEKTIVA texten (egen override om satt, annars mallens
 * standard) som VÄRDE — aldrig en tom ruta med placeholder. En chip per fält visar
 * "Mallens standard" vs "Egen text", med "↩ Mallens text" för att återgå. Vid spar
 * skickas '' för fält som är identiska med mallens standard (= ingen override i DB),
 * och BARA det här kortets fält skickas (servern rör inte övriga sidors text).
 */
export type CopyFieldDef = {
  name: string
  label: string
  hint?: string
  /** >1 → textarea med så många rader. */
  rows?: number
}

export type PreviewFieldRegistration = {
  name: string
  /** Den sparade/effektiva text som finns i storefrontens första render. */
  value: string
}

export function CopyFieldsCard({
  tenantId,
  fields,
  overrides,
  defaults,
  onSaved,
  onFlash,
  onFlashField,
  onDraftChange,
  onRegister,
  onUnregister,
  visibleFields,
}: {
  tenantId: string
  fields: CopyFieldDef[]
  /** Sparade overrides per fält ('' = ingen — mallens standard gäller). */
  overrides: Record<string, string>
  /** Mallens standardtext per fält (temats THEME_CONTENT). */
  defaults: Record<string, string>
  /** Efter lyckad spar (t.ex. ladda om previewen). */
  onSaved?: () => void
  /** "Visa var": markera fältets text i previewen (postMessage → copy-flash). */
  onFlash?: (text: string) => void
  /** Stabil preview-koppling. Till skillnad från textmatchningen tål den dubbletter. */
  onFlashField?: (name: string) => void
  /** Osparad text till iframe-previewn. Skriver aldrig till servern. */
  onDraftChange?: (name: string, value: string) => void
  /** Registrerar kandidater; iframe-DOM:en avgör sedan vilka som faktiskt renderas. */
  onRegister?: (cardId: string, fields: PreviewFieldRegistration[]) => void
  onUnregister?: (cardId: string) => void
  /** null = storefronten kartläggs, Set = bara verifierat renderade fält. */
  visibleFields?: ReadonlySet<string> | null
}) {
  const cardId = useId()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await saveTenantStorefrontCopy(prev, fd)
      if (res.success) onSaved?.()
      return res
    },
    {},
  )

  // Effektiv text per fält = override || mallens standard. Keyed på värdena så en
  // orelaterad re-render aldrig sväljer pågående redigering; en riktig spar (nya
  // sparade värden) resettar.
  const initial = useMemo(() => {
    const v: Record<string, string> = {}
    for (const f of fields) v[f.name] = overrides[f.name] || defaults[f.name] || ''
    return v
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map((f) => `${f.name}=${overrides[f.name] ?? ''}|${defaults[f.name] ?? ''}`).join(' ')])

  const [vals, setVals] = useState(initial)
  useEffect(() => setVals(initial), [initial])

  const registrationSignature = fields
    .map((field) => `${field.name}=${initial[field.name] ?? ''}`)
    .join('\u001f')
  useEffect(() => {
    if (!onRegister) return
    onRegister(
      cardId,
      fields.map((field) => ({ name: field.name, value: initial[field.name] ?? '' })),
    )
    return () => onUnregister?.(cardId)
    // Fältdefinitionerna skapas nära respektive sektion i SidaStudio. Signaturen
    // gör registreringen värdestabil även när React ger oss en ny array-referens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, registrationSignature, onRegister, onUnregister])

  const renderedFields = visibleFields === undefined
    ? fields
    : visibleFields === null
      ? []
      : fields.filter((field) => visibleFields.has(field.name))

  const isOwn = (name: string) => (vals[name] ?? '') !== (defaults[name] ?? '')
  const dirty = renderedFields.some((f) => (vals[f.name] ?? '') !== (overrides[f.name] || defaults[f.name] || ''))

  const setValue = (name: string, value: string) => {
    setVals((current) => ({ ...current, [name]: value }))
    onDraftChange?.(name, value)
  }

  if (visibleFields === null) {
    return <p className={styles.hint}>Läser av den valda mallens verkliga innehåll…</p>
  }

  if (visibleFields !== undefined && renderedFields.length === 0) {
    return (
      <p className={styles.hint}>
        Den här mallen visar inga redigerbara texter i den här delen. Därför visas inga
        pekknappar här.
      </p>
    )
  }

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      {/* Servern får overriden ('' när texten = mallens standard → ingen override). */}
      {renderedFields.map((f) => (
        <input
          key={f.name}
          type="hidden"
          name={f.name}
          value={isOwn(f.name) ? (vals[f.name] ?? '') : ''}
        />
      ))}

      {renderedFields.map((f) => {
        const own = isOwn(f.name)
        return (
          <label key={f.name} className={styles.field}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {f.label}
              <span style={own ? chipOwn : chipDefault}>{own ? 'Egen text' : 'Mallens standard'}</span>
              {own ? (
                <button
                  type="button"
                  style={miniBtn}
                  onClick={() => setValue(f.name, defaults[f.name] ?? '')}
                  title="Återgå till mallens standardtext"
                >
                  ↩ Mallens text
                </button>
              ) : null}
              {onFlashField || onFlash ? (
                <button
                  type="button"
                  style={{ ...miniBtn, marginLeft: 'auto' }}
                  onClick={() =>
                    onFlashField ? onFlashField(f.name) : onFlash?.(vals[f.name] ?? '')
                  }
                  title="Markerar var på sidan den här texten syns (scrollar dit och blinkar)"
                >
                  Visa var
                </button>
              ) : null}
            </span>
            {(f.rows ?? 1) > 1 ? (
              <textarea
                rows={f.rows}
                value={vals[f.name] ?? ''}
                onChange={(e) => setValue(f.name, e.target.value)}
              />
            ) : (
              <input
                value={vals[f.name] ?? ''}
                onChange={(e) => setValue(f.name, e.target.value)}
              />
            )}
            {f.hint ? <span className={styles.hint}>{f.hint}</span> : null}
          </label>
        )
      })}

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending || !dirty}>
          {pending ? 'Sparar…' : 'Spara text'}
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
