'use client'

import { useActionState, useEffect, useState, type CSSProperties } from 'react'
import type { TenantBranding } from '@corevo/ui'
import { saveBranding, type ActionState } from '@/lib/admin/actions'
import styles from './admin.module.css'

const FALLBACK = {
  color_primary: '#1f6feb',
  color_bg: '#ffffff',
  color_fg: '#111111',
  // Default = storefront-guldet (--gold / --color-accent). Inget ändras visuellt
  // förrän salongen själv väljer en accentfärg. Håll i synk med packages/ui/tokens.css.
  color_accent: '#f5a623',
}

// Namngiven, illustrativ/konfigurerbar palett (playbook §4.3). Detta är ett TREDJE,
// separat lager — INTE de 5 shippade temana, INTE preview-presets. Salongen plockar
// en accent härifrån eller via "egen färg"-väljaren.
const SWATCHES: readonly (readonly [string, string])[] = [
  ['#5E7361', 'Salvia'],
  ['#B0894A', 'Mässing'],
  ['#C56A4E', 'Terrakotta'],
  ['#8A7CB0', 'Lavendel'],
  ['#2E4739', 'Skog'],
  ['#9A8B7A', 'Lera'],
  ['#1C1C1A', 'Svart'],
  ['#FAF8F4', 'Cream'],
]

// Self-rendering font-tiles: var bricka renderar i sitt EGET snitt. Värdet som sparas
// är en CSS font-family-sträng (samma kontrakt som det gamla fritext-fältet);
// '' = temats standard. Generiska fallbacks så icke-laddade snitt ändå skiljer sig
// visuellt (serif vs sans vs kondenserad) i back-office.
const FONTS: readonly (readonly [string, string])[] = [
  ['', 'Temats standard'],
  ['"Cormorant Garamond", Georgia, serif', 'Cormorant'],
  ['"Playfair Display", Georgia, serif', 'Playfair'],
  ['"Fraunces", "Times New Roman", serif', 'Fraunces'],
  ['"Jost", system-ui, sans-serif', 'Jost'],
  ['Inter, system-ui, sans-serif', 'Inter'],
  ['Oswald, "Arial Narrow", sans-serif', 'Oswald'],
]

const FIELD_LABELS: Record<string, string> = {
  color_primary: 'Primärfärg',
  color_bg: 'Bakgrund',
  color_fg: 'Text',
  color_accent: 'Accent',
  font_body: 'Typsnitt',
  logo: 'Logotyp',
}

// Legible text colour for a given accent background — mirrors injectTenantTokens'
// accentForeground() in @corevo/ui (identical luminance threshold + values) so the
// preview's accent CTA matches what the published storefront renders.
function accentFg(hex: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return '#15281f'
  let h = m[1]
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 >= 0.6 ? '#15281f' : '#ffffff'
}

type Work = {
  color_primary: string
  color_bg: string
  color_fg: string
  color_accent: string
  font_body: string
}

export function BrandingForm({
  branding,
  slug,
  salonName,
  siteUrl,
  heroImage,
}: {
  branding: TenantBranding
  slug: string
  salonName: string
  siteUrl: string
  heroImage: string | null
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveBranding, {})

  const init: Work = {
    color_primary: branding.color_primary || FALLBACK.color_primary,
    color_bg: branding.color_bg || FALLBACK.color_bg,
    color_fg: branding.color_fg || FALLBACK.color_fg,
    color_accent: branding.color_accent || FALLBACK.color_accent,
    font_body: branding.font_body ?? '',
  }

  // working (vad som redigeras) vs baseline (senast publicerat). dirty = de skiljer
  // sig, eller en logga-ändring är köad. history = undo-stack. changed = senast
  // redigerad nyckel (driver "ändrad"-pill + preview-highlight).
  const [work, setWork] = useState<Work>(init)
  const [baseline, setBaseline] = useState<Work>(init)
  const [history, setHistory] = useState<Work[]>([])
  const [changed, setChanged] = useState<string | null>(null)

  const [removeLogo, setRemoveLogo] = useState(false)
  const [localLogo, setLocalLogo] = useState<string | null>(null)
  const [newLogo, setNewLogo] = useState(false)

  const dirty = JSON.stringify(work) !== JSON.stringify(baseline) || newLogo || removeLogo

  function edit<K extends keyof Work>(key: K, value: Work[K]) {
    setHistory((h) => [...h, work])
    setWork((w) => ({ ...w, [key]: value }))
    setChanged(key)
  }

  function undo() {
    setHistory((h) => {
      if (!h.length) return h
      const prev = h[h.length - 1]!
      setWork(prev)
      setChanged(null)
      return h.slice(0, -1)
    })
  }

  // Preview the file the owner just chose (before upload) via an object URL — cleanup on unmount/replace.
  useEffect(() => {
    return () => {
      if (localLogo) URL.revokeObjectURL(localLogo)
    }
  }, [localLogo])

  // På Publicera: servern håller nu denna palett → den blir den nya baslinjen
  // (dirty → false, bandet flippar till "publicerat"), och logga-köandet nollas.
  useEffect(() => {
    if (state.success) {
      setBaseline(work)
      setHistory([])
      setChanged(null)
      setNewLogo(false)
      setRemoveLogo(false)
      setLocalLogo((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  const shownLogo = localLogo ?? (removeLogo ? null : branding.logo_url ?? null)

  return (
    <form action={formAction} className={styles.brand}>
      {/* Hidden fält bevarar saveBranding-kontraktet (samma name=-nycklar som förut). */}
      <input type="hidden" name="color_primary" value={work.color_primary} />
      <input type="hidden" name="color_bg" value={work.color_bg} />
      <input type="hidden" name="color_fg" value={work.color_fg} />
      <input type="hidden" name="color_accent" value={work.color_accent} />
      <input type="hidden" name="font_body" value={work.font_body} />

      <div className={styles.brandActions}>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={undo}
          disabled={!history.length}
        >
          ↶ Ångra
        </button>
        <a className={styles.ghostBtn} href={siteUrl} target="_blank" rel="noreferrer">
          Visa storefront ↗
        </a>
        <button type="submit" className={styles.publishBtn} disabled={!dirty || pending}>
          {pending ? 'Publicerar…' : '✓ Publicera'}
        </button>
      </div>

      {/* Dirty↔publicerat-band (callout-mönster). Båda states obligatoriska (playbook §4.3). */}
      <div
        className={`${styles.band} ${dirty ? styles.bandWarn : styles.bandOk}`}
        role="status"
      >
        <span className={styles.bandIcon} aria-hidden>
          {dirty ? '!' : '✓'}
        </span>
        <span>
          {dirty
            ? 'Osparade ändringar — förhandsvisningen uppdateras live. Tryck Publicera för att spara.'
            : 'Allt publicerat. Storefronten visar senaste versionen.'}
        </span>
      </div>

      {state.error ? (
        <div className={`${styles.band} ${styles.bandErr}`} role="alert">
          <span className={styles.bandIcon} aria-hidden>
            !
          </span>
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className={styles.brandGrid}>
        <div className={styles.brandControls}>
          {(
            [
              ['color_primary', 'Primärfärg'],
              ['color_bg', 'Bakgrund'],
              ['color_fg', 'Text'],
              ['color_accent', 'Accent'],
            ] as const
          ).map(([key, label]) => (
            <ColorRole
              key={key}
              label={label}
              value={work[key]}
              changed={changed === key}
              onPick={(v) => edit(key, v)}
            />
          ))}

          <div className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.eyebrowLabel}>Typsnitt</span>
              {changed === 'font_body' ? <span className={styles.changedPill}>ändrad</span> : null}
            </div>
            <div className={styles.fontTiles}>
              {FONTS.map(([val, name]) => {
                const sel = work.font_body === val
                const oswald = val.startsWith('Oswald')
                return (
                  <button
                    type="button"
                    key={name}
                    className={`${styles.fontTile} ${sel ? styles.fontTileSel : ''}`}
                    style={{ fontFamily: val || undefined }}
                    onClick={() => edit('font_body', val)}
                    aria-pressed={sel}
                  >
                    <span
                      style={
                        oswald ? { textTransform: 'uppercase', letterSpacing: '.08em' } : undefined
                      }
                    >
                      {name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.eyebrowLabel}>Logotyp</span>
              {changed === 'logo' ? <span className={styles.changedPill}>ändrad</span> : null}
            </div>
            {shownLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownLogo} alt="Nuvarande logotyp" className={styles.logoPreview} />
            ) : null}
            {/* Worlded dropzone (mock §3.6): dashed-glyph + copy. <label> sveper den
                WIRADE <input type=file> (visuellt gömd, samma name="logo") → riktig
                R2-uppladdning bevarad, bara grammatiken byts från native-kontrollen. */}
            <label className={styles.dropzone}>
              <span className={styles.dropzoneGlyph} aria-hidden>
                ↑
              </span>
              <span className={styles.dropzoneText}>
                Dra hit eller <b>välj fil</b>
                <span className={styles.dropzoneHint}>Byts utan deploy (R2)</span>
              </span>
              <input
                type="file"
                name="logo"
                className={styles.visuallyHidden}
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  setLocalLogo((prev) => {
                    if (prev) URL.revokeObjectURL(prev)
                    return f ? URL.createObjectURL(f) : null
                  })
                  setNewLogo(!!f)
                  if (f) {
                    setRemoveLogo(false)
                    setChanged('logo')
                  }
                }}
              />
            </label>
            {branding.logo_url && !localLogo ? (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  name="remove_logo"
                  value="true"
                  checked={removeLogo}
                  onChange={(e) => {
                    setRemoveLogo(e.target.checked)
                    setChanged('logo')
                  }}
                />
                Ta bort logotyp
              </label>
            ) : null}
            <span className={styles.muted}>PNG/JPG/WEBP/SVG/GIF, max 8 MB.</span>
          </div>
        </div>

        <BrandingPreview
          work={work}
          logo={shownLogo}
          slug={slug}
          salonName={salonName}
          heroImage={heroImage}
          changed={changed}
        />
      </div>
    </form>
  )
}

/** En roll (primär/bakgrund/text/accent): namngiven swatch-ring-picker + egen-färg-escape. */
function ColorRole({
  label,
  value,
  changed,
  onPick,
}: {
  label: string
  value: string
  changed: boolean
  onPick: (v: string) => void
}) {
  return (
    <div className={styles.group}>
      <div className={styles.groupHead}>
        <span className={styles.eyebrowLabel}>{label}</span>
        {changed ? <span className={styles.changedPill}>ändrad</span> : null}
      </div>
      <div className={styles.swatches}>
        {SWATCHES.map(([hex, name]) => {
          const sel = value.toLowerCase() === hex.toLowerCase()
          // Vald = ring i sin EGEN färg, separerad från brickan med en paper-gap.
          const ring = sel
            ? `0 0 0 2px var(--c-paper, #fff), 0 0 0 4px ${hex}`
            : '0 0 0 1px color-mix(in srgb, var(--c-ink) 16%, transparent)'
          return (
            <button
              type="button"
              key={hex}
              title={name}
              aria-label={name}
              aria-pressed={sel}
              className={styles.swatch}
              style={{ background: hex, boxShadow: ring }}
              onClick={() => onPick(hex)}
            />
          )
        })}
        <label className={styles.customSwatch} title="Egen färg">
          <input type="color" value={value} onChange={(e) => onPick(e.target.value)} />
          <span className={styles.swatchHex}>{value.toUpperCase()}</span>
        </label>
      </div>
    </div>
  )
}

/** Live-preview i browser-chrome — renderas i storefront-världen / salongens egna
 *  färger (ALDRIG forest/gold). Repaintar direkt medan ägaren redigerar. */
function BrandingPreview({
  work,
  logo,
  slug,
  salonName,
  heroImage,
  changed,
}: {
  work: Work
  logo: string | null
  slug: string
  salonName: string
  heroImage: string | null
  changed: string | null
}) {
  const { color_primary: primary, color_bg: bg, color_fg: fg, color_accent: accent, font_body: font } = work

  const heroBg = heroImage
    ? `linear-gradient(rgba(0,0,0,.28), rgba(0,0,0,.62)), url("${heroImage}") center / cover`
    : `linear-gradient(135deg, ${primary}, ${fg})`

  // hl(): redigerat preview-element får gold-outline (changed-field-highlight).
  const hl = (k: string): CSSProperties | undefined =>
    changed === k
      ? { outline: '2px solid var(--c-gold)', outlineOffset: '3px', borderRadius: '4px' }
      : undefined

  const screenStyle = { background: bg, color: fg, fontFamily: font || undefined } as CSSProperties

  return (
    <div className={styles.previewWrap}>
      <span className={`${styles.eyebrowLabel} ${styles.previewEyebrow}`}>
        <span className={styles.previewEyebrowDot} aria-hidden />
        Live-förhandsvisning · storefront
      </span>
      <div className={styles.chrome}>
        <div className={styles.chromeBar}>
          <span className={styles.dot} style={{ background: '#E0726A' }} />
          <span className={styles.dot} style={{ background: '#E6B34D' }} />
          <span className={styles.dot} style={{ background: '#7FB47F' }} />
          <span className={styles.urlPill}>{slug}.corevo.se</span>
        </div>
        <div className={styles.screen} style={screenStyle}>
          <div className={styles.screenNav}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className={styles.navLogo} style={hl('logo')} />
            ) : (
              <span className={styles.navBrand} style={{ color: primary, ...hl('logo'), ...hl('font_body') }}>
                {salonName}
              </span>
            )}
            <span className={styles.navLinks}>
              <span>Tjänster</span>
              <span>Om oss</span>
            </span>
          </div>

          <div className={styles.hero} style={{ background: heroBg }}>
            <div className={styles.heroInner}>
              <p className={styles.heroEyebrow}>Välkommen till {salonName}</p>
              <h3 className={styles.heroTitle} style={hl('font_body')}>
                Boka din tid online
              </h3>
              <div className={styles.heroCtas}>
                <span
                  className={styles.cta}
                  style={{ background: accent, color: accentFg(accent), ...hl('color_accent') }}
                >
                  Boka tid
                </span>
                <span
                  className={styles.ctaGhost}
                  style={{ borderColor: '#fff', color: '#fff', ...hl('color_primary') }}
                >
                  Se tjänster
                </span>
              </div>
            </div>
          </div>

          <div className={styles.serviceRow} style={hl('color_bg')}>
            <div>
              <div className={styles.serviceName}>Exempeltjänst</div>
              <div className={styles.serviceMeta}>45 min</div>
            </div>
            <div className={styles.servicePrice} style={{ color: primary, ...hl('color_primary') }}>
              450 kr
            </div>
          </div>
        </div>
      </div>
      {/* gold-100 runtime-explainer (mock §3.6 L114-117). */}
      <div className={styles.runtimeNote}>
        <span className={styles.runtimeNoteIcon} aria-hidden>
          i
        </span>
        <span className={styles.runtimeNoteText}>
          Färg och typsnitt läses som runtime-inställningar — därför syns ändringen direkt
          utan deploy.
        </span>
      </div>
      <div className={styles.previewMeta}>
        {changed ? (
          <span className={styles.updated}>
            Uppdaterade: <strong>{FIELD_LABELS[changed]}</strong>
          </span>
        ) : (
          <span className={styles.muted}>Förhandsvisning · din publika sajt, i ditt eget tema</span>
        )}
      </div>
    </div>
  )
}
