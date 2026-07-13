'use client'

import { useActionState, useState } from 'react'
import {
  saveTenantStaffPhoto,
  setTenantStaffOnSite,
  saveTenantStaffProfile,
  type ActionState,
} from '@/lib/platform/actions'
import styles from './platform.module.css'

/** En RIKTIG medarbetare (staff-rad) som publika team-sektionen härleds ur. */
export type StaffTeamMember = {
  id: string
  title: string | null
  /** Bokningsbarhet (staff.active) — en inaktiv medarbetare visas ALDRIG på sidan,
   *  oavsett showOnSite. Redigeras i Personal-fliken, aldrig här. */
  active: boolean
  /** staff.avatar_url — null = standard-silhuett på sidan. */
  avatarUrl: string | null
  /** staff.show_on_site — styr ENDAST publika team-sektionen. */
  showOnSite: boolean
  /** goal-64 (0057): teamsidans presentationsfält. Kortnamnet är det mallarnas teamkort
   *  visar och det bokningens djuplänk hälsar med ("Boka tid hos Vera"). */
  shortName?: string | null
  specialties?: string | null
  bio?: string | null
}

/**
 * Teamet på publika sidan = salongens RIKTIGA personal (Zivar 2026-07-09: "när man
 * lägger in en barberare som ska kunna bokas ska den komma in på sidan; under
 * Redigera sidan kunna ändra bild och klicka av så en inte syns"). En rad per
 * medarbetare: porträtt-thumbnail (eller silhuett), namn, foto-uppladdning
 * (saveTenantStaffPhoto → staff.avatar_url) och visa/dölj-toggle
 * (setTenantStaffOnSite → staff.show_on_site). Själva medarbetarna (lägg
 * till/ta bort, tjänster, schema, bokningsbarhet) sköts i Personal-fliken.
 */
export function StaffTeamCard({
  tenantId,
  staff,
  onSaved,
  onFlash,
}: {
  tenantId: string
  staff: StaffTeamMember[]
  onSaved?: () => void
  onFlash?: (text: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {staff.map((m) => (
        <StaffMemberRow
          key={m.id}
          tenantId={tenantId}
          member={m}
          onSaved={onSaved}
          onFlash={onFlash}
        />
      ))}
    </div>
  )
}

const displayName = (m: StaffTeamMember): string => m.title?.trim() || 'Namnlös medarbetare'

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

function StaffMemberRow({
  tenantId,
  member,
  onSaved,
  onFlash,
}: {
  tenantId: string
  member: StaffTeamMember
  onSaved?: () => void
  onFlash?: (text: string) => void
}) {
  const [photoState, photoAction, photoPending] = useActionState<ActionState, FormData>(
    async (p, fd) => {
      const r = await saveTenantStaffPhoto(p, fd)
      if (r.success) onSaved?.()
      return r
    },
    {},
  )
  const [visState, visAction, visPending] = useActionState<ActionState, FormData>(
    async (p, fd) => {
      const r = await setTenantStaffOnSite(p, fd)
      if (r.success) onSaved?.()
      return r
    },
    {},
  )
  // goal-64: teamsidans presentation (kortnamn · specialiteter · bio). Egen action, egen
  // form — den rör ALDRIG bokningsbarhet eller synlighet, bara vad kortet SÄGER.
  const [profState, profAction, profPending] = useActionState<ActionState, FormData>(
    async (p, fd) => {
      const r = await saveTenantStaffProfile(p, fd)
      if (r.success) onSaved?.()
      return r
    },
    {},
  )
  // Tvåstegsbekräftelse (samma mönster som ServicesManager/StaffRoster): "Ta bort
  // foto" raderade förr porträttet på ETT klick. Klick 1 armerar, klick 2 skickar.
  const [armed, setArmed] = useState(false)

  const name = displayName(member)
  const visibleOnSite = member.active && member.showOnSite

  return (
    <div style={{ border: '1px solid var(--c-line, #e2e7de)', borderRadius: 9, padding: 12, opacity: visibleOnSite ? 1 : 0.72 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Porträtt-thumbnail — eller monogram-silhuetten (samma tomtillstånd som sidan). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatarUrl}
              alt={name}
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--c-line)' }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                border: '1px solid var(--c-line)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 22,
                color: 'var(--c-forest, #1F4636)',
                background: 'var(--c-paper-2, #f2f4ef)',
              }}
            >
              {initialsOf(name)}
            </span>
          )}
          {onFlash ? (
            <button
              type="button"
              className={styles.btn}
              style={{ padding: '2px 6px', fontSize: 10.5 }}
              onClick={() => onFlash(name)}
            >
              Visa var
            </button>
          ) : null}
        </div>

        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 14 }}>{name}</strong>
            <span className={styles.hint} style={{ margin: 0 }}>
              {!member.active
                ? 'Inaktiv (Personal-fliken) — visas aldrig på sidan'
                : member.showOnSite
                  ? 'Visas på sidan'
                  : 'Dold på sidan — fortfarande bokningsbar'}
            </span>
          </div>

          {/* Foto: ladda upp/byt (fil → staff.avatar_url) eller ta bort (→ silhuett). */}
          <form action={photoAction} className={styles.form} style={{ gap: 6 }}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="staffId" value={member.id} />
            <label className={styles.field}>
              <span>{member.avatarUrl ? 'Byt foto' : 'Foto'}</span>
              <input type="file" name="image" accept="image/*" required />
              <span className={styles.hint}>
                PNG/JPG/WEBP, max 8 MB. Utan foto visas en standard-silhuett på sidan.
              </span>
            </label>
            <div className={styles.actions}>
              <button type="submit" className="btn-primary" disabled={photoPending}>
                {photoPending ? 'Sparar…' : 'Spara foto'}
              </button>
              {member.avatarUrl ? (
                armed ? (
                  <>
                    <button
                      type="submit"
                      name="remove"
                      value="true"
                      className={styles.btnDanger}
                      disabled={photoPending}
                      formNoValidate
                    >
                      {photoPending ? '…' : 'Säker? Ta bort permanent'}
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={photoPending}
                      onClick={() => setArmed(false)}
                    >
                      Ångra
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={() => setArmed(true)}
                  >
                    Ta bort foto
                  </button>
                )
              ) : null}
              {photoState.error ? (
                <span className={`${styles.feedback} auth-error`} role="alert">
                  {photoState.error}
                </span>
              ) : null}
              {photoState.success ? (
                <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
                  {photoState.success}
                </span>
              ) : null}
            </div>
          </form>

          {/* TEAMSIDANS PRESENTATION (goal-64, 0057). Mallarnas teamkort visar kortnamn,
              specialiteter och bio — utan de här fälten hade de korten fått amputeras.
              Blankt fält = rensat (null) → renderas INTE publikt (render-on-present). */}
          <details className={styles.form} style={{ gap: 6 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
              Presentation på teamsidan
            </summary>
            <form action={profAction} className={styles.form} style={{ gap: 6, marginTop: 8 }}>
              <input type="hidden" name="tenantId" value={tenantId} />
              <input type="hidden" name="staffId" value={member.id} />
              <label className={styles.field}>
                <span>Kortnamn</span>
                <input
                  type="text"
                  name="short_name"
                  maxLength={40}
                  defaultValue={member.shortName ?? ''}
                  placeholder="Vera"
                />
                <span className={styles.hint}>
                  Används på teamkortet och i bokningens förifyllnad. Blankt → fullständigt namn.
                </span>
              </label>
              <label className={styles.field}>
                <span>Specialiteter</span>
                <input
                  type="text"
                  name="specialties"
                  maxLength={200}
                  defaultValue={member.specialties ?? ''}
                  placeholder="Korta klipp · Siluetter · Konsultation"
                />
              </label>
              <label className={styles.field}>
                <span>Bio</span>
                <textarea name="bio" maxLength={1200} rows={3} defaultValue={member.bio ?? ''} />
                <span className={styles.hint}>
                  Blankt fält visas inte alls på sidan — hitta aldrig på en text åt personen.
                </span>
              </label>
              <div className={styles.actions}>
                <button type="submit" className="btn-primary" disabled={profPending}>
                  {profPending ? 'Sparar…' : 'Spara presentation'}
                </button>
                {profState.error ? (
                  <span className={`${styles.feedback} auth-error`} role="alert">
                    {profState.error}
                  </span>
                ) : null}
                {profState.success ? (
                  <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
                    {profState.success}
                  </span>
                ) : null}
              </div>
            </form>
          </details>

          {/* Visa/dölj på sidan (staff.show_on_site) — rör aldrig bokningsbarheten. */}
          <form action={visAction} className={styles.actions} style={{ marginTop: 0 }}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="staffId" value={member.id} />
            <input type="hidden" name="show" value={String(!member.showOnSite)} />
            <button type="submit" className={styles.btn} disabled={visPending}>
              {visPending ? 'Sparar…' : member.showOnSite ? 'Dölj från sidan' : 'Visa på sidan'}
            </button>
            {visState.error ? (
              <span className={`${styles.feedback} auth-error`} role="alert">
                {visState.error}
              </span>
            ) : null}
            {visState.success ? (
              <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
                {visState.success}
              </span>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  )
}
