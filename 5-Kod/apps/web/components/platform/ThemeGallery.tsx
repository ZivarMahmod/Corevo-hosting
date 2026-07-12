'use client'

import { useMemo, useState } from 'react'
import {
  THEME_PALETTES,
  THEME_CATEGORIES,
  type ThemeCategory,
  type ThemePalette,
} from '@/lib/platform/theme-palettes'
import s from './ThemeGallery.module.css'

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
 * goal-61: stilarna bor i ThemeGallery.module.css — inline kunde inte bära
 * hover/fokus, och detta är plattformens mest säljande yta. Logiken orörd.
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
      <div role="tablist" aria-label="Mallkategori" className={s.tabRow}>
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
              className={s.tab}
            >
              {c.label}
              <span className={s.countPill}>{count}</span>
            </button>
          )
        })}
      </div>
      <p className={s.hint}>{categories.find((c) => c.key === cat)?.hint}</p>

      <div className={s.filterRow}>
        <div className={s.chipRow}>
          <button type="button" onClick={() => setTag(null)} aria-pressed={tag === null} className={s.chip}>
            Alla
          </button>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(tag === t ? null : t)}
              aria-pressed={tag === t}
              className={s.chip}
            >
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
          className={s.search}
        />
      </div>

      <div className={compact ? `${s.grid} ${s.gridCompact}` : s.grid}>
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

      {shown.length === 0 ? <p className={s.empty}>Ingen mall matchar filtret.</p> : null}
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
    <button type="button" onClick={onPick} aria-pressed={isSelected} className={s.card}>
      <span className={s.thumb} style={{ background: theme.bg }} aria-hidden="true">
        {theme.hero ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote-image-configen är fryst (aldrig next/image)
          <img src={theme.hero} alt="" className={s.thumbImg} loading="lazy" />
        ) : null}
        {/* Palett-remsan ovanpå fotot: mallens primary + ink + bakgrund. */}
        <span className={s.paletteStrip}>
          <span className={s.dot} style={{ background: theme.primary }} />
          <span className={s.dot} style={{ background: theme.fg }} />
          <span className={s.dot} style={{ background: theme.bg, border: '1px solid rgba(0,0,0,.15)' }} />
        </span>
      </span>

      <span className={s.nameRow}>
        <b className={s.name}>{theme.name}</b>
        {isCurrent ? <span className={`${s.badge} ${s.badgeLive}`}>Nuvarande</span> : null}
        {isDefault && !isCurrent ? <span className={`${s.badge} ${s.badgeDefault}`}>Branschens förval</span> : null}
        {isSelected && !isCurrent ? <span className={`${s.badge} ${s.badgePreview}`}>Vald</span> : null}
      </span>
      <span className={s.desc}>{theme.desc}</span>
    </button>
  )
}
