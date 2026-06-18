'use client'

// SiteEditor — Sajtbyggare S2 visuella editor-skal (klient-komponent).
//
// Två-kolumns-skal: vänster sidopanel med per-region-kontroller grupperade per typ
// (Texter / Bilder / Färger / Typsnitt / Logotyp), höger en live <iframe> som visar
// den RIKTIGA storefronten med de osparade ändringarna inbakade (draft → URL-param,
// same-origin preview-route renderar den verkliga sidan). "Spara" persisterar via
// saveSiteContent → ändringen blir live UTAN deploy (runtime läser settings/branding
// direkt). Ingen TipTap (ej installerad) — textarea är v0-textkontrollen.
//
// All draft-logik är PURE och importeras (overlay-model + draft-url): denna fil
// håller bara React-state + DOM. Helperna är immutabla → setDraft(d => op(d, ...)).

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveSiteContent } from '@/lib/sajtbyggare/save-site-content'
import type { ResolvedRegion } from '@/lib/sajtbyggare/resolve'
import {
  type Draft,
  setDraftValue,
  clearDraftValue,
  blankDraftValue,
  draftToEdits,
  effectiveValue,
  isModified,
  hasUnsavedChanges,
} from '@/lib/sajtbyggare/editor/overlay-model'
import { encodeDraft } from '@/lib/sajtbyggare/editor/draft-url'

// ── Locked prop-kontrakt (admin-sidan skickar EXAKT detta) ──────────────────

export type SiteEditorRegion = {
  key: string
  type: 'text' | 'image' | 'color' | 'font' | 'logo'
  value: string | null
  provenance: 'standard' | 'modifierad'
  label: string
}

export type SiteEditorMediaAsset = {
  id: string
  url: string
  alt: string | null
}

type SiteEditorProps = {
  slug: string
  templateKey: string
  regions: SiteEditorRegion[]
  mediaAssets: SiteEditorMediaAsset[]
  /** 'live' (default) = dagens beteende (Spara → saveSiteContent + iframe-preview).
   *  'onboarding' = tenant finns ej än → ingen Spara, ingen iframe; draften lyfts
   *  i stället till föräldern via onDraftChange (CreateTenantForm fångar den). */
  mode?: 'live' | 'onboarding'
  /** Anropas (i onboarding-läge) varje gång draften ändras så föräldern kan
   *  spegla den till sitt dolda <input name="site_content_draft">. */
  onDraftChange?: (draft: Draft) => void
}

// ── Konstanter ──────────────────────────────────────────────────────────────

const PREVIEW_DEBOUNCE_MS = 400

/** Säkra typsnitts-stackar editorn erbjuder (font-regioner). Den aktiva regionens
 *  värde läggs alltid till så ett okänt sparat värde inte tappas ur listan. */
const FONT_STACKS: { value: string; label: string }[] = [
  { value: "'Jost', 'Inter', sans-serif", label: 'Jost (sans)' },
  { value: "'Inter', sans-serif", label: 'Inter (sans)' },
  { value: 'Georgia, serif', label: 'Georgia (serif)' },
  { value: 'system-ui, sans-serif', label: 'System (sans)' },
]

const SECTIONS: { type: SiteEditorRegion['type']; heading: string }[] = [
  { type: 'text', heading: 'Texter' },
  { type: 'image', heading: 'Bilder' },
  { type: 'color', heading: 'Färger' },
  { type: 'font', heading: 'Typsnitt' },
  { type: 'logo', heading: 'Logotyp' },
]

// ── Hjälpare ────────────────────────────────────────────────────────────────

/** Bygg ett minimalt ResolvedRegion-format så de PURE overlay-helperna
 *  (isModified / effectiveValue) kan anropas. `source` är irrelevant för dem men
 *  krävs av typen → 'universal'. */
function toResolved(region: SiteEditorRegion): ResolvedRegion {
  return {
    key: region.key,
    type: region.type,
    value: region.value,
    source: 'universal',
    provenance: region.provenance,
  }
}

/** Det värde en kontroll ska visa: draftat värde om nyckeln är draftad, annars det
 *  sparade region-värdet (eller tom sträng för text-inputs). */
function controlValue(region: SiteEditorRegion, draft: Draft): string {
  if (region.key in draft) return draft[region.key] ?? ''
  return region.value ?? ''
}

// ── Badge ───────────────────────────────────────────────────────────────────

function ProvenanceBadge({ modified }: { modified: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.4,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        color: modified ? 'var(--c-forest, #2f4733)' : 'var(--c-ink-3, #6b7280)',
        background: modified ? 'var(--c-sage-soft, #e7efe8)' : 'var(--c-cream, #f3f1ea)',
        border: `1px solid ${modified ? 'var(--c-forest, #2f4733)' : 'var(--c-line, #e2e0d8)'}`,
      }}
    >
      {modified ? 'modifierad' : 'standard'}
    </span>
  )
}

// ── MediaPicker (inline overlay — återanvänder redan laddad media, INGEN uppladdning) ──

function MediaPicker({
  assets,
  onSelect,
  onClose,
}: {
  assets: SiteEditorMediaAsset[]
  onSelect: (url: string) => void
  onClose: () => void
}) {
  // Esc stänger.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Välj bild ur bildbiblioteket"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(20, 24, 20, 0.5)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 100%)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--c-paper, #fff)',
          border: '1px solid var(--c-line, #e2e0d8)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--c-line, #e2e0d8)',
          }}
        >
          <strong style={{ fontSize: 15 }}>Välj bild</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--c-ink-3, #6b7280)',
              padding: 4,
            }}
          >
            Stäng
          </button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto' }}>
          {assets.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--c-ink-3, #6b7280)', margin: 0 }}>
              Inga bilder ännu — ladda upp i{' '}
              <a
                href="/admin/media"
                style={{ color: 'var(--c-forest, #2f4733)', textDecoration: 'underline' }}
              >
                Bildbibliotek
              </a>
              .
            </p>
          ) : (
            <div
              role="listbox"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 10,
              }}
            >
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  aria-label={a.alt?.trim() ? a.alt : 'Bild'}
                  title={a.alt?.trim() ? a.alt : undefined}
                  onClick={() => {
                    onSelect(a.url)
                    onClose()
                  }}
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: '1px solid var(--c-line, #e2e0d8)',
                    background: 'var(--c-cream, #f3f1ea)',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.alt ?? ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Per-region-kontroller ─────────────────────────────────────────────────────

type ControlProps = {
  region: SiteEditorRegion
  draft: Draft
  setDraft: (updater: (prev: Draft) => Draft) => void
  onPickImage: (regionKey: string) => void
}

/** Liten textlänk-knapp för "Återställ" / "Töm" (ingen ny CSS-fil). */
function MiniAction({
  children,
  onClick,
  disabled,
}: {
  children: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 'none',
        background: 'transparent',
        padding: 0,
        fontSize: 12,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--c-ink-4, #9ca3af)' : 'var(--c-forest, #2f4733)',
        textDecoration: disabled ? 'none' : 'underline',
      }}
    >
      {children}
    </button>
  )
}

function RegionControl({ region, draft, setDraft, onPickImage }: ControlProps) {
  const resolved = toResolved(region)
  const modified = isModified(resolved, draft)
  const isDrafted = region.key in draft
  const inputId = `region-${region.key.replace(/[^a-z0-9]+/gi, '-')}`

  const reset = () => setDraft((d) => clearDraftValue(d, region.key))
  const blank = () => setDraft((d) => blankDraftValue(d, region.key))
  const write = (value: string) => setDraft((d) => setDraftValue(d, region.key, value))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 0',
        borderBottom: '1px solid var(--c-line, #e2e0d8)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-ink, #1f2421)' }}>
          {region.label}
        </label>
        <ProvenanceBadge modified={modified} />
      </div>

      {region.type === 'text' && (
        <>
          <textarea
            id={inputId}
            value={controlValue(region, draft)}
            rows={3}
            maxLength={2000}
            onChange={(e) => write(e.target.value)}
            style={{
              width: '100%',
              resize: 'vertical',
              fontSize: 14,
              lineHeight: 1.45,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--c-line, #e2e0d8)',
              background: 'var(--c-paper, #fff)',
              color: 'inherit',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 14 }}>
            <MiniAction onClick={reset} disabled={!isDrafted}>
              Återställ
            </MiniAction>
            <MiniAction onClick={blank}>Töm</MiniAction>
          </div>
        </>
      )}

      {region.type === 'color' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color"
              aria-label={`${region.label} — färgväljare`}
              value={normalizeHex(controlValue(region, draft))}
              onChange={(e) => write(e.target.value)}
              style={{
                width: 44,
                height: 36,
                padding: 0,
                border: '1px solid var(--c-line, #e2e0d8)',
                borderRadius: 8,
                background: 'transparent',
                cursor: 'pointer',
              }}
            />
            <input
              id={inputId}
              type="text"
              inputMode="text"
              spellCheck={false}
              placeholder="#5E7361"
              value={controlValue(region, draft)}
              onChange={(e) => write(e.target.value)}
              style={{
                flex: 1,
                fontSize: 14,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--c-line, #e2e0d8)',
                background: 'var(--c-paper, #fff)',
                color: 'inherit',
                fontFamily: 'monospace',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <MiniAction onClick={reset} disabled={!isDrafted}>
              Återställ
            </MiniAction>
            <MiniAction onClick={blank}>Töm</MiniAction>
          </div>
        </>
      )}

      {region.type === 'font' && (
        <>
          <select
            id={inputId}
            value={controlValue(region, draft)}
            onChange={(e) => write(e.target.value)}
            style={{
              width: '100%',
              fontSize: 14,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--c-line, #e2e0d8)',
              background: 'var(--c-paper, #fff)',
              color: 'inherit',
            }}
          >
            {fontOptions(controlValue(region, draft)).map((opt) => (
              <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>
                {opt.label}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 14 }}>
            <MiniAction onClick={reset} disabled={!isDrafted}>
              Återställ
            </MiniAction>
            <MiniAction onClick={blank}>Töm</MiniAction>
          </div>
        </>
      )}

      {(region.type === 'image' || region.type === 'logo') && (
        <ImageControl
          region={region}
          resolved={resolved}
          draft={draft}
          isDrafted={isDrafted}
          onPick={() => onPickImage(region.key)}
          onReset={reset}
          onBlank={blank}
          inputId={inputId}
        />
      )}
    </div>
  )
}

function ImageControl({
  region,
  resolved,
  draft,
  isDrafted,
  onPick,
  onReset,
  onBlank,
  inputId,
}: {
  region: SiteEditorRegion
  resolved: ResolvedRegion
  draft: Draft
  isDrafted: boolean
  onPick: () => void
  onReset: () => void
  onBlank: () => void
  inputId: string
}) {
  const effective = effectiveValue(resolved, draft)
  return (
    <div id={inputId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 10,
          border: '1px solid var(--c-line, #e2e0d8)',
          background: 'var(--c-cream, #f3f1ea)',
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
        }}
      >
        {effective ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={effective}
            alt={region.label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 11, color: 'var(--c-ink-3, #6b7280)' }}>Ingen</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onPick}
            style={{
              fontSize: 13,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--c-line, #e2e0d8)',
              background: 'var(--c-paper, #fff)',
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            {effective ? 'Byt bild' : 'Välj bild'}
          </button>
          {effective && (
            <button
              type="button"
              onClick={onBlank}
              style={{
                fontSize: 13,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--c-line, #e2e0d8)',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--c-ink-3, #6b7280)',
              }}
            >
              Ta bort
            </button>
          )}
        </div>
        <MiniAction onClick={onReset} disabled={!isDrafted}>
          Återställ
        </MiniAction>
      </div>
    </div>
  )
}

// ── Små rena hjälpare för kontroll-värden ─────────────────────────────────────

/** type=color kräver en giltig #rrggbb; ge en safe fallback när hexen inte är klar. */
function normalizeHex(v: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : '#000000'
}

/** Font-select-alternativen: de säkra stackarna + det aktiva värdet om det inte
 *  redan finns (så ett okänt sparat typsnitt inte tappas / select inte blir tomt). */
function fontOptions(current: string): { value: string; label: string }[] {
  const trimmed = current.trim()
  if (!trimmed || FONT_STACKS.some((f) => f.value === trimmed)) return FONT_STACKS
  return [{ value: trimmed, label: `Nuvarande (${trimmed})` }, ...FONT_STACKS]
}

// ── Huvudkomponent ────────────────────────────────────────────────────────────

export function SiteEditor({
  slug,
  templateKey,
  regions,
  mediaAssets,
  mode = 'live',
  onDraftChange,
}: SiteEditorProps) {
  const router = useRouter()
  const isOnboarding = mode === 'onboarding'
  const [draft, setDraft] = useState<Draft>({})
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState(false)
  const [isSaving, startSaving] = useTransition()

  // Debouncad preview-URL — iframen pekar på den RIKTIGA storefronten + draft.
  const [previewSrc, setPreviewSrc] = useState(
    () => `/sajtbyggare-spike/preview/${slug}?draft=${encodeDraft({})}`,
  )
  useEffect(() => {
    const t = setTimeout(() => {
      setPreviewSrc(`/sajtbyggare-spike/preview/${slug}?draft=${encodeDraft(draft)}`)
    }, PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [draft, slug])

  // Onboarding-läge: lyft draften till föräldern (CreateTenantForm) vid varje ändring
  // så dess dolda <input name="site_content_draft"> alltid speglar nuläget. Live-läget
  // rör inte detta (onDraftChange är undefined där → optional-call är en no-op).
  useEffect(() => {
    if (isOnboarding) onDraftChange?.(draft)
  }, [isOnboarding, onDraftChange, draft])

  const dirty = hasUnsavedChanges(draft)

  // Gruppera regionerna per typ → sektioner (behåller given ordning inom varje typ).
  const grouped = useMemo(() => {
    const map = new Map<SiteEditorRegion['type'], SiteEditorRegion[]>()
    for (const r of regions) {
      const list = map.get(r.type)
      if (list) list.push(r)
      else map.set(r.type, [r])
    }
    return map
  }, [regions])

  // En setDraft som speglar (updater)-formen kontrollerna förväntar sig + rensar notiser.
  const updateDraft = (updater: (prev: Draft) => Draft) => {
    setSavedNote(false)
    setSaveError(null)
    setDraft((prev) => updater(prev))
  }

  const onSave = () => {
    setSaveError(null)
    setSavedNote(false)
    startSaving(async () => {
      const res = await saveSiteContent(templateKey, draftToEdits(draft))
      if (res.ok) {
        setDraft({}) // sparade värden är nu baseline (sidan re-laddas → nya region-props)
        setSavedNote(true)
        router.refresh()
      } else {
        setSaveError(res.error)
      }
    })
  }

  const pickerAssets = mediaAssets
  const onImagePicked = (url: string) => {
    if (pickerFor) updateDraft((d) => setDraftValue(d, pickerFor, url))
    setPickerFor(null)
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        alignItems: 'stretch',
        minHeight: '80vh',
        width: '100%',
      }}
    >
      {/* ── Sidopanel ── */}
      <aside
        style={{
          width: 360,
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--c-line, #e2e0d8)',
          borderRadius: 14,
          background: 'var(--c-paper, #fff)',
          overflow: 'hidden',
        }}
      >
        {/* Toppbar — Spara + status */}
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid var(--c-line, #e2e0d8)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {isOnboarding ? (
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: 'var(--c-ink-3, #6b7280)',
                lineHeight: 1.5,
              }}
            >
              Förhandsvisning visas när kunden har skapats.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!dirty || isSaving}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    padding: '9px 18px',
                    borderRadius: 9,
                    border: 'none',
                    cursor: !dirty || isSaving ? 'default' : 'pointer',
                    color: '#fff',
                    background:
                      !dirty || isSaving ? 'var(--c-ink-4, #9ca3af)' : 'var(--c-forest, #2f4733)',
                  }}
                >
                  {isSaving ? 'Sparar…' : 'Spara'}
                </button>
                {dirty && !isSaving && (
                  <span style={{ fontSize: 12, color: 'var(--c-ink-3, #6b7280)' }}>
                    Du har osparade ändringar
                  </span>
                )}
                {savedNote && !dirty && !isSaving && (
                  <span style={{ fontSize: 12, color: 'var(--c-forest, #2f4733)' }} role="status">
                    Sparat — ändringen är live.
                  </span>
                )}
              </div>

              {saveError && (
                <p
                  role="alert"
                  style={{ margin: 0, fontSize: 12.5, color: 'var(--c-danger, #b42318)' }}
                >
                  {saveError}
                </p>
              )}

              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: 'var(--c-ink-3, #6b7280)',
                  lineHeight: 1.5,
                }}
              >
                Förhandsvisa live: dina ändringar går live direkt när du sparar — utan att sidan
                behöver byggas om eller publiceras.
              </p>
            </>
          )}
        </div>

        {/* Region-sektioner */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
          {SECTIONS.map((section) => {
            const list = grouped.get(section.type)
            if (!list || list.length === 0) return null
            return (
              <section key={section.type} style={{ marginTop: 16 }}>
                <h3
                  style={{
                    margin: '0 0 4px',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--c-ink-3, #6b7280)',
                  }}
                >
                  {section.heading}
                </h3>
                {list.map((region) => (
                  <RegionControl
                    key={region.key}
                    region={region}
                    draft={draft}
                    setDraft={updateDraft}
                    onPickImage={(key) => setPickerFor(key)}
                  />
                ))}
              </section>
            )
          })}

          {regions.length === 0 && (
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--c-ink-3, #6b7280)' }}>
              Den här mallen har inga redigerbara regioner.
            </p>
          )}
        </div>
      </aside>

      {/* ── Live-förhandsvisning ── */}
      <section
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--c-line, #e2e0d8)',
          borderRadius: 14,
          background: 'var(--c-paper, #fff)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--c-line, #e2e0d8)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <strong style={{ fontSize: 14 }}>Förhandsvisning</strong>
          <span style={{ fontSize: 12, color: 'var(--c-ink-3, #6b7280)' }}>
            {isOnboarding
              ? 'Förhandsvisning visas när kunden har skapats.'
              : 'Förhandsvisningen visar den riktiga sidan med dina ändringar — så här blir den live.'}
          </span>
        </div>
        {isOnboarding ? (
          <div
            style={{
              flex: 1,
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              background: 'var(--c-cream, #f3f1ea)',
            }}
          >
            <p
              style={{
                margin: 0,
                maxWidth: 320,
                textAlign: 'center',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--c-ink-3, #6b7280)',
              }}
            >
              Förhandsvisning visas när kunden har skapats.
            </p>
          </div>
        ) : (
          <iframe
            title="Förhandsvisning"
            src={previewSrc}
            style={{ flex: 1, width: '100%', border: 'none', background: 'var(--c-cream, #f3f1ea)' }}
          />
        )}
      </section>

      {pickerFor !== null && (
        <MediaPicker
          assets={pickerAssets}
          onSelect={onImagePicked}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  )
}
