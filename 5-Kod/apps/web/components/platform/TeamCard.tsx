'use client'

import { useActionState, useState } from 'react'
import { saveTenantTeamMember, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

type Member = { name: string; role: string; img: string }

/**
 * Teamet på Om oss-sidan (branding.team) — Zivar: "Om oss-sidan är för bild och lite
 * text på barberaren; Personal-fliken sköter det tekniska (tjänster, schema, bokning)".
 * En medlem per kort: namn + roll/presentation + foto, spara/ta bort per medlem +
 * lägg till ny. Tomt team → sektionen döljs helt på sidan.
 */
export function TeamCard({
  tenantId,
  team,
  onSaved,
  onFlash,
  onFlashImage,
}: {
  tenantId: string
  team: Member[]
  onSaved?: () => void
  onFlash?: (text: string) => void
  onFlashImage?: (url: string) => void
}) {
  const [adding, setAdding] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {team.length === 0 && !adding ? (
        <p className={styles.hint} style={{ margin: 0 }}>
          Inget team upplagt — team-sektionen visas inte på Om oss-sidan förrän du lägger
          till en medlem.
        </p>
      ) : null}
      {team.map((m, i) => (
        <MemberForm
          key={`${m.name}-${i}`}
          tenantId={tenantId}
          index={i}
          member={m}
          onSaved={onSaved}
          onFlash={onFlash}
          onFlashImage={onFlashImage}
        />
      ))}
      {adding ? (
        <MemberForm tenantId={tenantId} index={null} member={{ name: '', role: '', img: '' }} onSaved={onSaved} />
      ) : (
        <button type="button" className={styles.btn} style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(true)}>
          + Lägg till medlem
        </button>
      )}
    </div>
  )
}

function MemberForm({
  tenantId,
  index,
  member,
  onSaved,
  onFlash,
  onFlashImage,
}: {
  tenantId: string
  /** null = ny medlem. */
  index: number | null
  member: Member
  onSaved?: () => void
  onFlash?: (text: string) => void
  onFlashImage?: (url: string) => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (p, fd) => {
      const r = await saveTenantTeamMember(p, fd)
      if (r.success) onSaved?.()
      return r
    },
    {},
  )

  return (
    <form
      action={formAction}
      className={styles.form}
      style={{ border: '1px solid var(--c-line, #e2e7de)', borderRadius: 9, padding: 12 }}
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="index" value={index ?? ''} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {member.img ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={member.img}
              alt={member.name}
              style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--c-line)' }}
            />
            {onFlashImage ? (
              <button type="button" className={styles.btn} style={{ padding: '2px 6px', fontSize: 10.5 }} onClick={() => onFlashImage(member.img)}>
                Visa var
              </button>
            ) : null}
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Namn
                {onFlash && member.name ? (
                  <button type="button" className={styles.btn} style={{ padding: '2px 8px', fontSize: 11, marginLeft: 'auto' }} onClick={() => onFlash(member.name)}>
                    Visa var
                  </button>
                ) : null}
              </span>
              <input name="name" defaultValue={member.name} required maxLength={80} placeholder="Anna Svensson" />
            </label>
            <label className={styles.field}>
              <span>Roll / kort presentation</span>
              <input name="role" defaultValue={member.role} maxLength={300} placeholder="Barberare · fade-specialist" />
            </label>
          </div>
          <label className={styles.field}>
            <span>{member.img ? 'Byt foto (valfritt)' : 'Foto'}</span>
            <input type="file" name="image" accept="image/*" />
            <span className={styles.hint}>PNG/JPG/WEBP, max 8 MB. Visas som porträtt på Om oss-sidan.</span>
          </label>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : index === null ? 'Lägg till' : 'Spara'}
        </button>
        {index !== null ? (
          <button
            type="submit"
            name="remove"
            value="true"
            className={styles.btnDanger}
            disabled={pending}
            formNoValidate
          >
            Ta bort
          </button>
        ) : null}
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
