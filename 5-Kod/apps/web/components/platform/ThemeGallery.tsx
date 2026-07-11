'use client'

import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  THEME_PALETTES,
  THEME_CATEGORIES,
  type ThemeCategory,
  type ThemePalette,
} from '@/lib/platform/theme-palettes'

/**
 * MALL-GALLERIET — EN väljare, två ytor: kundkortets Sida-flik (ThemePicker) och
 * onboarding-studions tema-steg (PanelTema). goal-58 gjorde sviten 20 mallar; en platt
 * namnlista blev en röra att välja ur.
 *
 * UX: kategori-flikar (Blomsterhandel / Salong & barber) → tagg-chips → fritextsök →
 * kort med mallens EGEN hero-bild och riktiga palett. Branschens förval får en gyllene
 * "Branschens förval"-markering, så operatören kan trycka Nästa utan att välja alls.
 *
 * Rent presentational: ingen server-action, ingen spar. Föräldern äger valet.
 */
export function ThemeGallery({
  value,
  onChange,
  currentKey,
  defaultKey,
  compact = false,
}: {
  /** Vald mall (förhandsvisas). */
  value: string
  onChange: (key: string) => void
  /** Mallen som ligger LIVE idag (kundkortet) — får "Nuvarande"-märket. */
  currentKey?: string
  /** Branschens förval (onboarding) — får "Branschens förval"-märket. */
  defaultKey?: string | null
  /** Smalare kort (studions panel är en smal kolumn). */
  compact?: boolean
}) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)

  const valueTheme = THEME_PALETTES.find((t) => t.key === value)
  // "Kundegna" är inte ett val — fliken finns bara för den kund som REDAN kör en sådan.
  const categories = useMemo(
    () => THEME_CATEGORIES.filter((c) => c.key !== 'kund' || valueTheme?.category === 'kund'),
    [valueTheme],
  )
  const [cat, setCat] = useState<ThemeCategory>(valueTheme?.category ?? 'florist')

  const inCategory = useMemo(() => THEME_PALETTES.filter((t) => t.category === cat), [cat])
  // Bara taggar som ger träff i kategorin (aldrig en chip som ger 0 resultat).
  const tags = useMemo(() => [...new Set(inCategory.flatMap((t) => t.tags))].sort(), [inCategory])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inCategory.filter(
      (t) =>
        (!tag || t.tags.includes(tag)) &&
        (!q || `${t.name} ${t.desc} ${t.tags.join(' ')}`.toLowerCase().includes(q)),
    )
  }, [inCategory, tag, query])

  return (
    <div>
      <div role="tablist" aria-label="Mallkategori" style={tabRow}>
        {categories.map((c) => {
          const active = c.key === cat
          const count = THEME_PALETTES.filter((t) => t.category === c.key).length
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setCat(c.key)
                setTag(null)
              }}
              style={tabStyle(active)}
            >
              {c.label}
              <span style={countPill(active)}>{count}</span>
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--c-ink-3)', margin: '6px 2px 12px' }}>
        {categories.find((c) => c.key === cat)?.hint}
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setTag(null)} style={chip(tag === null)}>
            Alla
          </button>
          {tags.map((t) => (
            <button key={t} type="button" onClick={() => setTag(tag === t ? null : t)} style={chip(tag === t)}>
              {t}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök mall…"
          aria-label="Sök mall"
          style={search}
        />
      </div>

      <div style={grid(compact)}>
        {shown.map((t) => (
          <ThemeCard
            key={t.key}
            theme={t}
            isCurrent={t.key === currentKey}
            isDefault={t.key === defaultKey}
            isSelected={t.key === value}
            onPick={() => onChange(t.key)}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--c-ink-3)', padding: '18px 2px' }}>Ingen mall matchar filtret.</p>
      ) : null}
    </div>
  )
}

/** Ett mallkort: mallens EGEN hero-bild + dess riktiga palett + namn/känsla. */
function ThemeCard({
  theme,
  isCurrent,
  isDefault,
  isSelected,
  onPick,
}: {
  theme: ThemePalette
  isCurrent: boolean
  isDefault: boolean
  isSelected: boolean
  onPick: () => void
}) {
  return (
    <button type="button" onClick={onPick} aria-pressed={isSelected} style={cardStyle(isSelected)}>
      <span style={{ ...thumb, background: theme.bg }} aria-hidden="true">
        {theme.hero ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote-image-configen är fryst (aldrig next/image)
          <img src={theme.hero} alt="" style={thumbImg} loading="lazy" />
        ) : null}
        {/* Palett-remsan ovanpå fotot: mallens primary + ink + bakgrund. */}
        <span style={paletteStrip}>
          <span style={{ ...dot, background: theme.primary }} />
          <span style={{ ...dot, background: theme.fg }} />
          <span style={{ ...dot, background: theme.bg, border: '1px solid rgba(0,0,0,.15)' }} />
        </span>
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>{theme.name}</b>
        {isCurrent ? <span style={badge('live')}>Nuvarande</span> : null}
        {isDefault && !isCurrent ? <span style={badge('default')}>Branschens förval</span> : null}
        {isSelected && !isCurrent ? <span style={badge('preview')}>Vald</span> : null}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--c-ink-3)', marginTop: 3, lineHeight: 1.4 }}>{theme.desc}</span>
    </button>
  )
}

/* ── stil ────────────────────────────────────────────────────────────────────── */

function grid(compact: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 150 : 196}px, 1fr))`,
    gap: compact ? 10 : 14,
  }
}
const tabRow: CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: 4,
  background: 'var(--c-mist, #f2f4f0)',
  borderRadius: 10,
  width: 'fit-content',
  maxWidth: '100%',
  flexWrap: 'wrap',
}
function tabStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 13px',
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    font: 'inherit',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? 'var(--c-forest, #1f4636)' : 'var(--c-ink-2, #4a534a)',
    background: active ? 'var(--c-paper, #fff)' : 'transparent',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
  }
}
function countPill(active: boolean): CSSProperties {
  return {
    fontSize: 10.5,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 999,
    background: active ? 'color-mix(in srgb, var(--c-forest) 12%, transparent)' : 'rgba(0,0,0,.06)',
    color: active ? 'var(--c-forest)' : 'var(--c-ink-3)',
  }
}
function chip(active: boolean): CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--c-forest, #1f4636)' : 'var(--c-line, #e2e7de)'}`,
    background: active ? 'color-mix(in srgb, var(--c-forest) 10%, transparent)' : 'var(--c-paper, #fff)',
    color: active ? 'var(--c-forest)' : 'var(--c-ink-2)',
    font: 'inherit',
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
  }
}
const search: CSSProperties = {
  marginLeft: 'auto',
  padding: '6px 11px',
  borderRadius: 8,
  border: '1px solid var(--c-line, #e2e7de)',
  background: 'var(--c-paper, #fff)',
  font: 'inherit',
  fontSize: 13,
  minWidth: 150,
}
function cardStyle(selected: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
    padding: 10,
    borderRadius: 10,
    border: `1.5px solid ${selected ? 'var(--c-forest, #1f4636)' : 'var(--c-line, #e2e7de)'}`,
    background: 'var(--c-paper, #fff)',
    color: 'var(--c-ink)',
    font: 'inherit',
    cursor: 'pointer',
    boxShadow: selected ? '0 0 0 3px color-mix(in srgb, var(--c-forest) 12%, transparent)' : 'none',
    transition: 'border-color 140ms ease, box-shadow 140ms ease',
  }
}
const thumb: CSSProperties = {
  position: 'relative',
  display: 'block',
  borderRadius: 6,
  overflow: 'hidden',
  border: '1px solid var(--c-line, #e2e7de)',
  aspectRatio: '4 / 3',
}
const thumbImg: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
const paletteStrip: CSSProperties = {
  position: 'absolute',
  left: 6,
  bottom: 6,
  display: 'flex',
  gap: 4,
  padding: 4,
  borderRadius: 999,
  background: 'rgba(255,255,255,.9)',
}
const dot: CSSProperties = { width: 10, height: 10, borderRadius: 999, display: 'block' }

function badge(kind: 'live' | 'preview' | 'default'): CSSProperties {
  const color =
    kind === 'live' ? 'var(--c-forest)' : kind === 'default' ? 'var(--c-gold, #a37d3c)' : 'var(--c-warning, #a37d3c)'
  return {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    padding: '1px 6px',
    borderRadius: 999,
  }
}
