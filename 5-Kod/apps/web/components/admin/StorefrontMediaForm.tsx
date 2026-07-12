'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { saveStorefrontMedia, type ActionState } from '@/lib/admin/actions'
import styles from './admin.module.css'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif'
const HERO_MAX = 5
const GALLERY_MAX = 8
const TEAM_MAX = 12
const STATS_MAX = 6

type TeamMember = { name: string; role: string; img: string }
type StatTuple = [value: string, label: string]

type MediaProps = {
  heroImages: string[]
  galleryImages: string[]
  aboutImage: string | null
  closingImage: string | null
  team: TeamMember[]
  stats: StatTuple[]
}

export function StorefrontMediaForm(props: MediaProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveStorefrontMedia, {})

  // After a save the page revalidates and feeds fresh props (just-saved uploads
  // are now canonical URLs). The sub-sections seed their state from props ONCE,
  // so bump a nonce on every success to remount them — this re-seeds from the
  // revalidated props, clears local blob previews + file inputs, and (crucially)
  // turns just-uploaded images into retained URLs so a second save doesn't drop
  // them. Key off `state` (a fresh object per dispatch), NOT state.success (an
  // identical string across saves would only fire the effect once).
  const [savedNonce, setSavedNonce] = useState(0)
  useEffect(() => {
    if (state.success) setSavedNonce((n) => n + 1)
  }, [state])

  return (
    <form action={formAction} className={`${styles.form} ${styles.formStacked}`} style={{ maxWidth: '46rem' }}>
      <p className={styles.muted} style={{ margin: '0 0 0.5rem' }}>
        Ladda upp egna bilder och innehåll för din publika sajt. Lämnar du något tomt visar vi en
        snygg standardbild tills du laddar upp egen.
      </p>

      <GallerySection
        key={`hero-${savedNonce}`}
        label="Hero-bilder"
        hint={`Stora bilder högst upp på sajten. Upp till ${HERO_MAX} st.`}
        existingField="hero_existing"
        filesField="hero_files"
        initial={props.heroImages}
        max={HERO_MAX}
        pending={pending}
      />

      <GallerySection
        key={`gallery-${savedNonce}`}
        label="Galleri"
        hint={`Bildgalleri på sajten. Upp till ${GALLERY_MAX} st.`}
        existingField="gallery_existing"
        filesField="gallery_files"
        initial={props.galleryImages}
        max={GALLERY_MAX}
        pending={pending}
      />

      <SingleImageSection
        key={`about-${savedNonce}`}
        label="Om oss-bild"
        hint="Bilden bredvid texten ”Om oss”."
        prefix="about"
        initial={props.aboutImage}
      />

      <SingleImageSection
        key={`closing-${savedNonce}`}
        label="Avslutningsbild"
        hint="Stor bild i sidans avslutande sektion."
        prefix="closing"
        initial={props.closingImage}
      />

      <TeamSection key={`team-${savedNonce}`} initial={props.team} pending={pending} />

      <StatsSection key={`stats-${savedNonce}`} initial={props.stats} pending={pending} />

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara bilder & innehåll'}
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

/* ── Hero / gallery: retained existing URLs + newly chosen files ── */
function GallerySection({
  label,
  hint,
  existingField,
  filesField,
  initial,
  max,
  pending,
}: {
  label: string
  hint: string
  existingField: string
  filesField: string
  initial: string[]
  max: number
  /** Formulärets spara-läge — inget får plockas bort medan det skickas. */
  pending: boolean
}) {
  // Retained server URLs (a remove toggle drops one from this list → no hidden
  // input emitted → the server doesn't keep it).
  const [retained, setRetained] = useState<string[]>(initial)
  // Tvåstegsbekräftelse: × plockade förr bort en sparad bild på ETT klick (den
  // försvann ur listan och nästa Spara skrev bort den ur DB). Klick 1 armerar
  // BILDEN (url:en), klick 2 tar bort. Samma röda tråd som ServicesManager.
  const [armedUrl, setArmedUrl] = useState<string | null>(null)
  // Object-URL previews for the files CURRENTLY in the file input. A native
  // multi-file <input> replaces its FileList on each pick (it can't accumulate
  // across separate selections), and only that FileList is submitted — so we
  // mirror exactly one selection here, keeping preview == what-gets-uploaded.
  const [locals, setLocals] = useState<string[]>([])

  // Revoke object URLs only on unmount (a ref reads the latest list so we don't
  // re-run cleanup — and leak — on every selection).
  const localsRef = useRef(locals)
  localsRef.current = locals
  useEffect(
    () => () => {
      localsRef.current.forEach((url) => URL.revokeObjectURL(url))
    },
    [],
  )

  const remaining = Math.max(0, max - retained.length)

  return (
    <div className={styles.field}>
      <span>{label}</span>
      <span className={styles.muted}>{hint}</span>

      {retained.length || locals.length ? (
        <div className={styles.mediaGrid}>
          {retained.map((url) => (
            <figure key={url} className={styles.mediaThumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" />
              <input type="hidden" name={existingField} value={url} />
              {armedUrl === url ? (
                <div className={styles.mediaConfirm}>
                  <button
                    type="button"
                    className={styles.mediaConfirmYes}
                    aria-label="Säker? Ta bort bilden permanent"
                    disabled={pending}
                    onClick={() => {
                      setRetained((prev) => prev.filter((u) => u !== url))
                      setArmedUrl(null)
                    }}
                  >
                    Säker? Ta bort permanent
                  </button>
                  <button
                    type="button"
                    className={styles.mediaConfirmNo}
                    disabled={pending}
                    onClick={() => setArmedUrl(null)}
                  >
                    Ångra
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.mediaRemove}
                  aria-label="Ta bort bild"
                  disabled={pending}
                  onClick={() => setArmedUrl(url)}
                >
                  ×
                </button>
              )}
            </figure>
          ))}
          {locals.map((url) => (
            <figure key={url} className={styles.mediaThumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" />
              <span className={styles.mediaNew}>Ny</span>
            </figure>
          ))}
        </div>
      ) : (
        <span className={styles.muted}>Ingen bild uppladdad ännu — standardbild visas.</span>
      )}

      <input
        type="file"
        name={filesField}
        accept={ACCEPT}
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // Replace previous previews with this selection (matches the input's
          // FileList, which is what submits).
          setLocals((prev) => {
            prev.forEach((url) => URL.revokeObjectURL(url))
            return files.map((f) => URL.createObjectURL(f))
          })
        }}
      />
      <span className={styles.muted}>
        PNG/JPG/WEBP/SVG/GIF, max 8 MB per bild. Max {max} bilder ({remaining} platser kvar utöver
        nya). Väljer du flera ersätter de tidigare valda (osparade) bilderna.
      </span>
    </div>
  )
}

/* ── About / closing: a single image with a remove toggle ── */
function SingleImageSection({
  label,
  hint,
  prefix,
  initial,
}: {
  label: string
  hint: string
  prefix: string
  initial: string | null
}) {
  const [removed, setRemoved] = useState(false)
  const [local, setLocal] = useState<string | null>(null)

  useEffect(
    () => () => {
      if (local) URL.revokeObjectURL(local)
    },
    [local],
  )

  const shown = local ?? (removed ? null : initial)

  return (
    <div className={styles.field}>
      <span>{label}</span>
      <span className={styles.muted}>{hint}</span>

      {shown ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="" className={styles.logoPreview} />
          {initial && !local ? (
            <label className={styles.check}>
              <input
                type="checkbox"
                name={`${prefix}_remove`}
                value="true"
                checked={removed}
                onChange={(e) => setRemoved(e.target.checked)}
              />
              Ta bort bild
            </label>
          ) : null}
        </span>
      ) : (
        <span className={styles.muted}>Ingen bild uppladdad ännu — standardbild visas.</span>
      )}

      {/* Retain the saved URL unless the owner removed or replaced it. */}
      {initial && !removed ? <input type="hidden" name={`${prefix}_existing`} value={initial} /> : null}

      <input
        type="file"
        name={`${prefix}_file`}
        accept={ACCEPT}
        onChange={(e) => {
          const f = e.target.files?.[0]
          setLocal((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return f ? URL.createObjectURL(f) : null
          })
          if (f) setRemoved(false)
        }}
      />
      <span className={styles.muted}>PNG/JPG/WEBP/SVG/GIF, max 8 MB.</span>
    </div>
  )
}

/* ── Team: repeatable name + role + photo ── */
function TeamSection({ initial, pending }: { initial: TeamMember[]; pending: boolean }) {
  const [rows, setRows] = useState<{ key: string; member: TeamMember }[]>(
    initial.map((m) => ({ key: crypto.randomUUID(), member: m })),
  )

  return (
    <div className={styles.field}>
      <span>Teamet</span>
      <span className={styles.muted}>
        Medarbetare som visas på sajten. Lämnar du detta tomt visas standardteam. Både namn och bild
        krävs för att en rad ska sparas.
      </span>

      {rows.map((r, i) => (
        <TeamRow
          key={r.key}
          index={i}
          member={r.member}
          pending={pending}
          onRemove={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
        />
      ))}

      <div>
        <button
          type="button"
          className={styles.btn}
          disabled={rows.length >= TEAM_MAX}
          onClick={() =>
            setRows((prev) => [...prev, { key: crypto.randomUUID(), member: { name: '', role: '', img: '' } }])
          }
        >
          + Lägg till medarbetare
        </button>
        {rows.length >= TEAM_MAX ? (
          <span className={styles.muted}> Max {TEAM_MAX} medarbetare.</span>
        ) : null}
      </div>
    </div>
  )
}

function TeamRow({
  index,
  member,
  pending,
  onRemove,
}: {
  index: number
  member: TeamMember
  pending: boolean
  onRemove: () => void
}) {
  const [local, setLocal] = useState<string | null>(null)
  // Tvåstegsbekräftelse: raden (namn + roll + foto) försvann förr på ETT klick.
  const [armed, setArmed] = useState(false)

  useEffect(
    () => () => {
      if (local) URL.revokeObjectURL(local)
    },
    [local],
  )

  const shown = local ?? (member.img || null)

  return (
    <div className={styles.repeatRow}>
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="" className={styles.teamThumb} />
      ) : (
        <span className={styles.teamThumbEmpty} aria-hidden="true" />
      )}
      <div className={styles.repeatFields}>
        <input
          name={`team_name_${index}`}
          defaultValue={member.name}
          placeholder="Namn (t.ex. Anna)"
          aria-label="Namn"
        />
        <input
          name={`team_role_${index}`}
          defaultValue={member.role}
          placeholder="Roll (t.ex. Grundare)"
          aria-label="Roll"
        />
        {/* Keep the saved photo URL unless a new file is chosen. */}
        <input type="hidden" name={`team_img_${index}`} value={member.img} />
        <input
          type="file"
          name={`team_photo_${index}`}
          accept={ACCEPT}
          onChange={(e) => {
            const f = e.target.files?.[0]
            setLocal((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return f ? URL.createObjectURL(f) : null
            })
          }}
        />
      </div>
      {armed ? (
        <span style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={pending}
            onClick={onRemove}
          >
            Säker? Ta bort permanent
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={pending}
            onClick={() => setArmed(false)}
          >
            Ångra
          </button>
        </span>
      ) : (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnDanger}`}
          disabled={pending}
          onClick={() => setArmed(true)}
        >
          Ta bort
        </button>
      )}
    </div>
  )
}

/* ── Stats: repeatable value + label ── */
function StatsSection({ initial, pending }: { initial: StatTuple[]; pending: boolean }) {
  const [rows, setRows] = useState<{ key: string; value: string; label: string }[]>(
    initial.map(([value, label]) => ({ key: crypto.randomUUID(), value, label })),
  )
  // Tvåstegsbekräftelse per rad (nyckel = radens key) — samma röda tråd som resten.
  const [armedKey, setArmedKey] = useState<string | null>(null)

  return (
    <div className={styles.field}>
      <span>Nyckeltal</span>
      <span className={styles.muted}>
        Korta siffror/ord som visas på sajten (t.ex. ”15 år” · ”erfarenhet”). Tomt = standardvärden.
        Både värde och text krävs för att ett nyckeltal ska sparas.
      </span>

      {rows.map((r, i) => (
        <div key={r.key} className={styles.repeatRow}>
          <div className={styles.repeatFields}>
            <input
              name={`stat_value_${i}`}
              defaultValue={r.value}
              placeholder="Värde (t.ex. 15 år)"
              aria-label="Värde"
            />
            <input
              name={`stat_label_${i}`}
              defaultValue={r.label}
              placeholder="Text (t.ex. erfarenhet)"
              aria-label="Text"
            />
          </div>
          {armedKey === r.key ? (
            <span style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={pending}
                onClick={() => {
                  setRows((prev) => prev.filter((x) => x.key !== r.key))
                  setArmedKey(null)
                }}
              >
                Säker? Ta bort permanent
              </button>
              <button
                type="button"
                className={styles.btn}
                disabled={pending}
                onClick={() => setArmedKey(null)}
              >
                Ångra
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              disabled={pending}
              onClick={() => setArmedKey(r.key)}
            >
              Ta bort
            </button>
          )}
        </div>
      ))}

      <div>
        <button
          type="button"
          className={styles.btn}
          disabled={rows.length >= STATS_MAX}
          onClick={() =>
            setRows((prev) => [...prev, { key: crypto.randomUUID(), value: '', label: '' }])
          }
        >
          + Lägg till nyckeltal
        </button>
        {rows.length >= STATS_MAX ? (
          <span className={styles.muted}> Max {STATS_MAX} nyckeltal.</span>
        ) : null}
      </div>
    </div>
  )
}
