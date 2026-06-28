'use client'

// Onboarding-studio (goal-48) — the 12 step PANELS + the PANEL_BY_STEP registry.
//
// Ported from the design source (4-Dokument-Underlag/01-acceptans/super-admin/
// studio.jsx PanelBranch…PanelLive) per W1 build-contract §5, but driven by the REAL
// presets + the pure StudioAction dispatch (state.ts) and the shared Field/
// ModuleStatePills (controls.tsx). DESIGN = LAG for the shell chrome (exact px/hex/
// copy); the bodies reuse real controls and honor the §9 honesty markers:
//   • REAL panels   : branch, namn, tema, modval, brand(accent+tagline), agare
//   • PARTIAL panels : brand-logo (placeholder box), text (only Företagsnamn wired)
//   • DEFERRED stubs : modplace (W5), modconf (display-only), tjanster (W3) — honest
//                      empty states, NO fake drag/list/toggle, NO fake DB-task theatre
//   • DISPLAY-only   : granska (derived checklist from REAL cfg), live (real Lansera
//                      → onLaunch; the real ActionState is surfaced by the parent)
//
// The registry is keyed by StepId and internal to this file + PanelHost (nothing else
// imports it), so it carries the two extra callbacks the special panels need.
import type { FC, ReactNode, CSSProperties } from 'react'
import { Badge, Button, Card, Icon, type IconName } from '@/components/portal/ui'
import { Field, ModuleStatePills } from './controls'
import type { PanelProps } from '@/lib/platform/onboarding-studio/state'
import { type StepId, stepDone } from '@/lib/platform/onboarding-studio/phases'
import { resolveModuleState, type StudioService } from '@/lib/platform/onboarding-studio/model'
import { modulesForVertical, termPlural, type TemplateOption } from '@/lib/platform/verticals-shared'
import { isReservedSlug } from '@/lib/platform/slug'
import {
  BOOKING_VARIANTS,
  BOOKING_VARIANT_LABELS,
  BOOKING_VARIANT_TAGS,
  BOOKING_VARIANT_DESCRIPTIONS,
  RECOMMENDED_BOOKING_VARIANT,
} from '@/lib/platform/booking-variant'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

/**
 * The prop bag every panel in the registry receives. Extends the frozen PanelProps
 * (cfg/dispatch/presets) with the two callbacks the special panels need:
 *   • onNext   — granska's in-body "Gå till lansering" advances to the NEXT step,
 *                which is `live` (granska→live are adjacent in FLAT_STEP_ORDER), so
 *                this is exactly the design's setStep('live'). ⚠️ The equivalence
 *                holds ONLY while those two steps stay adjacent in the W1 order — a
 *                later wave that inserts a step between them must switch to a real
 *                step-jump.
 *   • onLaunch — the live panel's gold Lansera button → the single createTenant submit.
 * Simple panels ignore both (they're typed `FC<PanelProps>` and slot in fine under
 * parameter contravariance).
 */
export type StudioPanelProps = PanelProps & {
  onNext: () => void
  onLaunch: () => void
}

// ── Shared inline tokens (lifted verbatim from the design / controls.tsx) ─────────
const labelStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
}
const groupEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-ui)',
}

/** Svenska hint per modul-läge (presentational; mirrors CreateTenantForm). */
const MODULE_STATE_HINTS: Record<ModuleState, string> = {
  off: 'Inte aktiverad.',
  draft: 'Aktiverad men dold publikt — syns bara internt.',
  live: 'Publik på storefronten.',
  paused: 'Tillfälligt stängd — visar "stängt" publikt.',
}

/** The built-in storefront themes (the 5 real lowercase STOREFRONT_THEMES keys) —
 *  fallback when the chosen bransch has no templates seeded in templatesByVertical.
 *  Mirrors CreateTenantForm's BUILTIN_TEMPLATES (key + display name only — the rich
 *  per-theme preview is the PreviewPane's job, W2). */
const BUILTIN_TEMPLATES: TemplateOption[] = [
  { key: 'salvia', name: 'Salvia' },
  { key: 'leander', name: 'Leander' },
  { key: 'zigge', name: 'Zigge' },
  { key: 'linnea', name: 'Linnea' },
  { key: 'edit', name: 'Edit' },
]

/** The brand-panel accent swatches (verbatim from studio.jsx:268 — 7 accents). */
const BRAND_ACCENTS = ['#5E7361', '#7E6E92', '#C8743C', '#B0693F', '#3A3733', '#A8455B', '#3E6B8C']

/* ════════════════════════════ panel scaffold ════════════════════════════ */

/** Column scaffold (port studio.jsx:56–67) — header (display h2 fs21 forest + sub)
 *  over a scrollable body. No `foot`: the global FooterNav lives in PanelHost. */
function Panel({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--c-line)', flex: 'none' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--c-forest)', margin: 0 }}>
          {title}
        </h2>
        {sub ? <p style={{ fontSize: 13, color: 'var(--c-ink-2)', margin: '6px 0 0', lineHeight: 1.5 }}>{sub}</p> : null}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{children}</div>
    </div>
  )
}

/** Honest deferred-state block (§9): a dashed card that READS as "not built yet" —
 *  never a fake list/drag/toggle. Used by the W-later panels. */
function DeferredStub({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
        padding: '40px 24px',
        border: '1px dashed var(--c-line-strong)',
        borderRadius: 12,
        background: 'var(--c-paper-2)',
      }}
    >
      <span style={{ color: 'var(--c-ink-3)' }}>
        <Icon name={icon} size={26} />
      </span>
      <div style={{ fontSize: 13, color: 'var(--c-ink-2)', lineHeight: 1.5, maxWidth: 290 }}>{children}</div>
    </div>
  )
}

/* ════════════════════════════ step panels ════════════════════════════ */

/**
 * The bransch list (step 1) — the FULL canon registry (cfg-data.js BRANCHES), not just the
 * 5 DB verticals. DISPLAY is canon: name + icon + staffWord + recommended-module count +
 * «Roadmap» badge for the live:false branches (Image #2). The CLICK dispatches `key`:
 *   • live overlaps (generell/frisör/barbershop/nagelstudio/restaurang) carry the DB
 *     vertical key, so applyBranch finds the real preset (modules/theme/terminology).
 *   • roadmap branches carry their canon key — applyBranch's `if (!v)` early-return just
 *     sets the bransch label ("inga låsningar", no verticals row needed yet).
 * `count` = canon rec.length (the recommendation hint shown in Image #2), NOT a live preset
 * count. Icons absent from IconName (heart/sparkle/bookmark) fall back to 'building' (the
 * icon every card used before). build-once-never-delete: barbershop is DB-live but missing
 * from the canon data — kept here so onboarding never loses a working bransch.
 */
const BRANSCH_REGISTRY: { key: string; name: string; icon: IconName; staffWord: string; count: number; live: boolean }[] = [
  { key: 'generell', name: 'Generell / egen mall', icon: 'layers', staffWord: 'Personal', count: 1, live: true },
  { key: 'frisör', name: 'Frisörsalong', icon: 'scissors', staffWord: 'Frisör', count: 3, live: true },
  { key: 'barbershop', name: 'Barbershop', icon: 'scissors', staffWord: 'Barberare', count: 2, live: true },
  { key: 'florist', name: 'Florist', icon: 'building', staffWord: 'Florist', count: 3, live: false },
  { key: 'klinik', name: 'Privatklinik', icon: 'shield', staffWord: 'Behandlare', count: 3, live: false },
  { key: 'bilverkstad', name: 'Bilverkstad', icon: 'settings', staffWord: 'Mekaniker', count: 4, live: false },
  { key: 'cykel', name: 'Cykelbutik', icon: 'repeat', staffWord: 'Mekaniker', count: 4, live: false },
  { key: 'hund', name: 'Hundsalong / Grooming', icon: 'building', staffWord: 'Groomer', count: 3, live: false },
  { key: 'nagelstudio', name: 'Nagelsalong', icon: 'building', staffWord: 'Nagelterapeut', count: 3, live: true },
  { key: 'tatuering', name: 'Tatueringsstudio', icon: 'edit', staffWord: 'Artist', count: 4, live: false },
  { key: 'optiker', name: 'Optiker', icon: 'eye', staffWord: 'Optiker', count: 2, live: false },
  { key: 'cafe', name: 'Café / Konditori', icon: 'coffee', staffWord: 'Personal', count: 3, live: false },
  { key: 'skraddare', name: 'Skräddare / Ändringsateljé', icon: 'scissors', staffWord: 'Skräddare', count: 4, live: false },
  { key: 'lassmed', name: 'Låssmed', icon: 'shield', staffWord: 'Låssmed', count: 2, live: false },
  { key: 'fotograf', name: 'Fotograf / Fotostudio', icon: 'eye', staffWord: 'Fotograf', count: 4, live: false },
  { key: 'secondhand', name: 'Second hand', icon: 'building', staffWord: 'Personal', count: 2, live: false },
  { key: 'stad', name: 'Städföretag', icon: 'building', staffWord: 'Städare', count: 3, live: false },
  { key: 'restaurang', name: 'Restaurang', icon: 'coffee', staffWord: 'Personal', count: 3, live: true },
]

/** branch — 2-col card grid of BRANSCH_REGISTRY. PURE categorization (Zivar): picking a
 *  branch ONLY tags the customer's type (cfg.branch) for later sorting/filtering — it does
 *  NOT pre-select any template or module. Canon icon + name + Roadmap pill (live:false) +
 *  staffWord subline (the category descriptor, not a module count). */
function PanelBranch({ cfg, dispatch }: PanelProps) {
  return (
    <Panel
      title="Vilken typ av kund?"
      sub="Bara för att kategorisera kunden — så du senare kan sortera och filtrera dina kunder per bransch. Det väljer ingen mall och inga moduler; allt sånt bestämmer du i egna steg."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {BRANSCH_REGISTRY.map((b) => {
          const on = cfg.branch === b.key
          return (
            <button
              key={b.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => dispatch({ type: 'applyBranch', key: b.key })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 14px',
                borderRadius: 12,
                border: `2px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
                background: on ? 'var(--c-paper-2)' : 'var(--c-paper)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--dur-fast)',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  flex: 'none',
                  borderRadius: 10,
                  background: on ? 'var(--c-forest)' : 'var(--c-paper-2)',
                  color: on ? '#fff' : 'var(--c-forest)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={b.icon} size={19} />
              </span>
              <span style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--c-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                  {!b.live ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '.04em',
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: 'var(--c-warning-bg)',
                        color: 'var(--c-warning)',
                      }}
                    >
                      Roadmap
                    </span>
                  ) : null}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--c-ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.staffWord}
                </span>
              </span>
              {on ? (
                <span style={{ color: 'var(--c-forest)', display: 'inline-flex' }}>
                  <Icon name="check" size={16} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

/** namn — W1-REAL. Företagsnamn → setName (auto-syncs slug until touched); subdomän
 *  → setSlug (sets slugTouched, §10-risk-1); reserved-slug warning vs the REAL list. */
function PanelNamn({ cfg, dispatch }: PanelProps) {
  const reserved = cfg.slug ? isReservedSlug(cfg.slug) : false
  return (
    <Panel
      title="Namn & subdomän"
      sub="Kundens företagsnamn och adressen de får. Egen domän är ett parkerat spår — subdomän räcker tills du säger KÖR."
    >
      <div style={{ display: 'grid', gap: 18 }}>
        <Field
          label="Företagsnamn"
          ph="t.ex. Klippoteket"
          value={cfg.name}
          onChange={(v) => dispatch({ type: 'setName', value: v })}
          hint="Går att ändra när som helst. Syns i header, footer, mail."
        />
        <div>
          <label style={labelStyle}>Subdomän</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 6,
              border: '1px solid var(--c-line)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--c-paper)',
            }}
          >
            <input
              value={cfg.slug}
              onChange={(e) =>
                dispatch({ type: 'setSlug', value: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })
              }
              placeholder="klippoteket"
              autoCapitalize="none"
              spellCheck={false}
              style={{
                flex: 1,
                padding: '11px 13px',
                border: 'none',
                outline: 'none',
                fontFamily: 'var(--font-ui)',
                fontSize: 14,
                background: 'transparent',
                color: 'var(--c-ink)',
              }}
            />
            <span
              style={{
                padding: '0 14px',
                color: 'var(--c-ink-3)',
                fontSize: 14,
                fontFamily: 'var(--font-ui)',
                borderLeft: '1px solid var(--c-line)',
                alignSelf: 'stretch',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              .{ROOT}
            </span>
          </div>
          {reserved ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 12.5,
                color: 'var(--c-danger)',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <Icon name="alert" size={14} /> &quot;{cfg.slug}&quot; är reserverad — kan inte bli en salongs-slug.
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}

/** tema — goal-50 look-GALLERY (sajtbyggare ON): the BOX. A flat thumbnail grid of
 *  ALL registered looks — no tags.bransch filter (live-bevis #2), no privileged theme.
 *  Pick → setTheme(look.key); the right preview renders that look's REAL HTML (distinct,
 *  live-bevis #3). Flag-OFF (looks empty/undefined) → the legacy {key,name} list,
 *  byte-identical. */
function PanelTema({ cfg, dispatch, presets, looks }: PanelProps) {
  if (looks && looks.length > 0) {
    return (
      <Panel
        title="Välj mall"
        sub="Alla mallar i din box — oavsett bransch. Varje mall ser olika ut. Välj en, så blir den sidans look; förhandsvisningen till höger visar den på riktigt."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {looks.map((look) => {
            const on = cfg.theme === look.key
            return (
              <button
                key={look.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => dispatch({ type: 'setTheme', key: look.key })}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0,
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: `2px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
                  background: 'var(--c-paper)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--dur-fast)',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    height: 96,
                    background: look.thumbnail
                      ? `#e9e6df center/cover no-repeat url("${look.thumbnail}")`
                      : '#e9e6df',
                    position: 'relative',
                  }}
                >
                  {on ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: 'var(--c-forest)',
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon name="check" size={14} />
                    </span>
                  ) : null}
                </span>
                <span style={{ padding: '10px 12px 12px' }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>{look.name}</span>
                  {look.vibeTags.length ? (
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--c-ink-3)', marginTop: 2 }}>
                      {look.vibeTags.join(' · ')}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </Panel>
    )
  }
  // Flag-OFF legacy list (byte-identical to the pre-goal-50 studio).
  const branschTemplates = cfg.branch ? presets.templatesByVertical[cfg.branch] : undefined
  const options = branschTemplates && branschTemplates.length > 0 ? branschTemplates : BUILTIN_TEMPLATES
  return (
    <Panel
      title="Temamall"
      sub="Ett av de byggda storefront-temana. Förhandsvisningen till höger visar kundens riktiga startsida."
    >
      <div style={{ display: 'grid', gap: 10 }}>
        {options.map((opt) => {
          const on = cfg.theme === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => dispatch({ type: 'setTheme', key: opt.key })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: 14,
                borderRadius: 14,
                border: `2px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
                background: 'var(--c-paper)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5, color: 'var(--c-ink)' }}>{opt.name}</span>
              {on ? (
                <span style={{ color: 'var(--c-forest)', display: 'inline-flex' }}>
                  <Icon name="check" size={18} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

/** modval — W1-REAL UI + W3 booking-variant sub-choice. Real catalog × preset state
 *  from modulesForVertical; rec/opt grouping derived from defaultState!=='off' (§10.7);
 *  booking restricted to live/paused; everything else off/draft/live/paused. setModule
 *  writes cfg.moduleStates. The booking row also carries the bokningsvariant picker
 *  (W3, form-parity → setVariant → cfg.variant). */
function PanelModval({ cfg, dispatch, presets }: PanelProps) {
  const options = modulesForVertical(presets, cfg.branch)
  const rec = options.filter((m) => m.defaultState !== 'off')
  const others = options.filter((m) => m.defaultState === 'off')

  // A render function (not a nested component) so the rows don't churn identity.
  const renderRow = (moduleKey: string, name: string) => {
    const isBooking = moduleKey === 'booking'
    const cur = resolveModuleState(cfg, moduleKey, presets)
    const choices: ModuleState[] = isBooking ? ['live', 'paused'] : [...MODULE_STATES]
    return (
      <div
        key={moduleKey}
        style={{
          padding: 14,
          border: `1px solid ${cur !== 'off' ? 'var(--c-forest)' : 'var(--c-line)'}`,
          borderRadius: 12,
          background: 'var(--c-paper)',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>
            {name}
            {isBooking ? (
              <span style={{ fontSize: 11.5, color: 'var(--c-ink-3)', fontWeight: 600, marginLeft: 8 }}>Kärnmodul</span>
            ) : null}
          </span>
        </div>
        <ModuleStatePills value={cur} choices={choices} onChange={(state) => dispatch({ type: 'setModule', key: moduleKey, state })} />
        <p style={{ fontSize: 12, color: 'var(--c-ink-3)', lineHeight: 1.5, margin: '8px 0 0' }}>{MODULE_STATE_HINTS[cur]}</p>
        {/* booking.variant — operator picks how the booking presents. FORM-PARITY port
            of CreateTenantForm's booking sub-choice (the design data defines BOOKING_VARIANTS
            but renders NO picker; the shipped form does, so the studio must not regress it).
            drawer/inline are presentation-deferred (readBookingMode → wizard) but still
            honest picks. → setVariant → buildCreateTenantFormData emits cfg.variant. */}
        {isBooking ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--c-line)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-ink)', marginBottom: 8 }}>
              Bokningsvariant — hur bokningen presenteras (99 % sker på mobil)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {BOOKING_VARIANTS.map((v) => {
                const von = cfg.variant === v
                const isRec = v === RECOMMENDED_BOOKING_VARIANT
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={von}
                    onClick={() => dispatch({ type: 'setVariant', variant: v })}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      border: `2px solid ${von ? 'var(--c-forest)' : 'var(--c-line)'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: von ? 'var(--c-paper-2)' : 'var(--c-paper)',
                      transition: 'all var(--dur-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--c-ink)' }}>{BOOKING_VARIANT_LABELS[v]}</span>
                      {isRec ? (
                        <Badge tone="gold" dot={false}>Rek.</Badge>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--c-ink-3)', fontWeight: 600 }}>{BOOKING_VARIANT_TAGS[v]}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--c-ink-2)', lineHeight: 1.45, margin: 0 }}>{BOOKING_VARIANT_DESCRIPTIONS[v]}</p>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <Panel
      title="Välj moduler"
      sub="Inget är låst till branschen — du väljer fritt bland alla moduler. De rekommenderade är föraktiverade; resten slår du på lika enkelt. Bokning är alltid minst live."
    >
      <div style={{ ...groupEyebrow, color: 'var(--c-gold-600)', marginBottom: 10 }}>Rekommenderat</div>
      {rec.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--c-ink-3)', margin: '0 0 10px' }}>Inga förvalda moduler för branschen.</p>
      ) : (
        rec.map((m) => renderRow(m.key, m.name))
      )}
      {others.length > 0 ? (
        <>
          <div style={{ ...groupEyebrow, color: 'var(--c-ink-3)', margin: '18px 0 10px' }}>Övriga moduler — välj fritt</div>
          {others.map((m) => renderRow(m.key, m.name))}
        </>
      ) : null}
    </Panel>
  )
}

/** modplace — DEFERRED-STUB (honest). Modules render at their FIXED catalog
 *  default_section_position (migr 0033–0036); there is NO per-tenant module-order read
 *  path on the storefront (verified: tenant-modules.ts has no sort_order / order-by). A
 *  drag-to-reorder UI here would write an order nothing reads (goal-47 theater trap), so
 *  this stays an honest stub until the storefront learns to read a per-tenant order —
 *  its own wave, not W5. */
function PanelModplace(_props: PanelProps) {
  return (
    <Panel title="Placera & ordna" sub="Ordningen modulerna ligger i på sidan.">
      <DeferredStub icon="grid">
        Modulerna visas i mallens standardordning. Att dra om ordningen kräver en separat ändring i hur
        storefronten renderar — det blir en egen våg, inte den här.
      </DeferredStub>
    </Panel>
  )
}

/** modconf — DISPLAY-ONLY (§9.6). No inputs. Reads the REAL active modules (resolved
 *  state ≠ off) as a read-only list; per-module bransch-inställningar = later wave. */
function PanelModconf({ cfg, presets }: PanelProps) {
  const active = modulesForVertical(presets, cfg.branch).filter((m) => resolveModuleState(cfg, m.key, presets) !== 'off')
  return (
    <Panel title="Modulinställningar" sub="Bransch-specifika regler per modul.">
      {active.length === 0 ? (
        <DeferredStub icon="settings">Inga aktiva moduler. Slå på moduler i steget «Välj moduler».</DeferredStub>
      ) : (
        <>
          <div style={{ ...groupEyebrow, color: 'var(--c-ink-3)', marginBottom: 10 }}>Aktiva moduler</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {active.map((m) => (
              <div
                key={m.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  border: '1px solid var(--c-line)',
                  borderRadius: 11,
                  background: 'var(--c-paper)',
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    flex: 'none',
                    borderRadius: 8,
                    background: 'var(--c-forest)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name="layers" size={15} />
                </span>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>{m.name}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--c-ink-3)', lineHeight: 1.5, margin: '14px 0 0' }}>
            Bransch-specifika inställningar per modul läggs till i en senare våg.
          </p>
        </>
      )}
    </Panel>
  )
}

/** brand — PARTIAL-REAL. Accent swatches → setAccent (or '' = temats standard);
 *  Tagline Field → setTagline. Logo = honest placeholder box only (no file input,
 *  upload = later wave, §9.9). */
function PanelBrand({ cfg, dispatch }: PanelProps) {
  return (
    <Panel
      title="Branding"
      sub="Logga, accentfärg och tagline — token-lagret (no-code). Slår igenom på storefronten utan deploy."
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Logga</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: 14,
              background: 'var(--c-paper-2)',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 11,
                border: '2px dashed var(--c-line-strong)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--c-ink-3)',
                flex: 'none',
              }}
            >
              <Icon name="upload" size={19} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--c-ink)' }}>Logga</div>
              <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 2 }}>Uppladdning (PNG/SVG → R2) kommer i en senare våg.</div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>
            Accentfärg <span style={{ color: 'var(--c-ink-3)', fontWeight: 400 }}>— skriver över temats primärfärg live</span>
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button
              type="button"
              title="Temats standard"
              aria-pressed={cfg.accent === ''}
              onClick={() => dispatch({ type: 'setAccent', hex: '' })}
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'var(--c-paper-2)',
                cursor: 'pointer',
                border: cfg.accent === '' ? '2px solid var(--c-forest)' : '2px solid var(--c-paper)',
                boxShadow: '0 0 0 1px var(--c-line)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--c-forest)',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--font-ui)',
              }}
            >
              Auto
            </button>
            {BRAND_ACCENTS.map((hex) => {
              const on = cfg.accent === hex
              return (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Accentfärg ${hex}`}
                  aria-pressed={on}
                  onClick={() => dispatch({ type: 'setAccent', hex })}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: hex,
                    cursor: 'pointer',
                    border: on ? '2px solid var(--c-forest)' : '2px solid var(--c-paper)',
                    boxShadow: '0 0 0 1px var(--c-line)',
                  }}
                />
              )
            })}
          </div>
        </div>

        <Field
          label="Tagline (footer/meta)"
          ph="Kort slogan för footer & meta"
          value={cfg.tagline}
          onChange={(v) => dispatch({ type: 'setTagline', value: v })}
        />
      </div>
    </Panel>
  )
}

/** text — W5-REAL. Rubrik (hero headline → heroTitle) + Ingress (hero paragraph →
 *  heroLede) + Företagsnamn (header). Writes settings.copy.{heroTitle,heroLede} via
 *  createTenant → renders on the live page + the preview (resolveThemeContent, all
 *  themes; empty = theme default). Ingress maps to heroLede, NOT the footer tagline (the
 *  brand panel owns tagline). The design's "klicka-redigera i previewen" overlay (salvia-
 *  only SiteEditor) is deferred — the design's own fields update the same data. */
function PanelText({ cfg, dispatch }: PanelProps) {
  return (
    <Panel title="Text & hjälte" sub="Rubriken och ingressen högst upp på sidan. Tomt = temats egen text. Ändringarna syns direkt i förhandsvisningen.">
      <div style={{ display: 'grid', gap: 16 }}>
        <Field
          label="Rubrik (hero)"
          ph="Din rubrik"
          value={cfg.heroTitle}
          onChange={(v) => dispatch({ type: 'setHeroTitle', value: v })}
          hint="Stora rubriken högst upp. Lämna tomt för temats förvalda rubrik."
        />
        <div>
          <label style={labelStyle}>Ingress</label>
          <textarea
            value={cfg.heroLede}
            onChange={(e) => dispatch({ type: 'setHeroLede', value: e.target.value })}
            rows={3}
            placeholder="Kort text under rubriken"
            style={{
              width: '100%',
              marginTop: 6,
              padding: '11px 13px',
              borderRadius: 10,
              border: '1px solid var(--c-line)',
              background: 'var(--c-paper)',
              fontFamily: 'var(--font-ui)',
              fontSize: 14,
              color: 'var(--c-ink)',
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>
        <Field
          label="Företagsnamn (header)"
          ph="Ditt företag"
          value={cfg.name}
          onChange={(v) => dispatch({ type: 'setName', value: v })}
        />
      </div>
    </Panel>
  )
}

/** tjanster — W4-REAL. Numbered name+price rows → setServices (whole-array set, mirrors
 *  the design's A.setContent). Names + price (kr); buildCreateTenantFormData converts
 *  kr→öre, createTenant inserts services rows on Lansera. Title/labels use the bransch's
 *  `service` term. price stored as the kr STRING the operator types (no controlled-
 *  number fight); the design collected names only — price added per the brief + design
 *  copy ("Pris i price_cents" / "minst en post med pris"). */
function PanelTjanster({ cfg, dispatch, presets }: PanelProps) {
  const terminology = cfg.branch ? presets.verticals.find((v) => v.key === cfg.branch)?.terminology ?? {} : {}
  const servicePlural = termPlural(terminology, 'service', 'Tjänster')
  const serviceWord = terminology.service ?? 'Tjänst'
  const set = (services: StudioService[]) => dispatch({ type: 'setServices', services })
  const add = () => set([...cfg.services, { name: '', price: '' }])
  const editName = (i: number, name: string) => set(cfg.services.map((s, j) => (j === i ? { ...s, name } : s)))
  const editPrice = (i: number, raw: string) => {
    // keep digits + only the FIRST decimal separator (comma/dot); strip later ones so the
    // kr field can't hold "10,50.5"-style junk that krToOre would parse surprisingly.
    const c = raw.replace(/[^0-9.,]/g, '')
    const sep = c.search(/[.,]/)
    const price = sep === -1 ? c : c.slice(0, sep + 1) + c.slice(sep + 1).replace(/[.,]/g, '')
    set(cfg.services.map((s, j) => (j === i ? { ...s, price } : s)))
  }
  const del = (i: number) => set(cfg.services.filter((_, j) => j !== i))

  const rowInput: CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: '10px 12px',
    border: '1px solid var(--c-line)',
    borderRadius: 10,
    background: 'var(--c-paper)',
    fontFamily: 'var(--font-ui)',
    fontSize: 14,
    outline: 'none',
    color: 'var(--c-ink)',
    boxSizing: 'border-box',
  }
  return (
    <Panel
      title={`${servicePlural} & priser`}
      sub="Datat bokningen visar. Minst en post för att kunden ska kunna boka. Pris i kr (sparas i öre) — ägaren finjusterar sen i sin admin."
    >
      <div style={{ display: 'grid', gap: 10 }}>
        {cfg.services.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 28,
                height: 28,
                flex: 'none',
                borderRadius: 7,
                background: 'var(--c-paper-2)',
                color: 'var(--c-forest)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-ui)',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {i + 1}
            </span>
            <input
              value={s.name}
              onChange={(e) => editName(i, e.target.value)}
              placeholder={`t.ex. ${serviceWord}`}
              style={rowInput}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 'none',
                width: 104,
                border: '1px solid var(--c-line)',
                borderRadius: 10,
                background: 'var(--c-paper)',
                overflow: 'hidden',
              }}
            >
              <input
                value={s.price}
                onChange={(e) => editPrice(i, e.target.value)}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Pris för ${s.name || `${serviceWord} ${i + 1}`}`}
                style={{ ...rowInput, border: 'none', borderRadius: 0, width: '100%', textAlign: 'right', padding: '10px 8px' }}
              />
              <span style={{ padding: '0 10px', color: 'var(--c-ink-3)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>kr</span>
            </div>
            <button
              type="button"
              aria-label="Ta bort"
              onClick={() => del(i)}
              style={{
                width: 34,
                height: 34,
                flex: 'none',
                borderRadius: 8,
                border: '1px solid var(--c-line)',
                background: 'var(--c-paper)',
                color: 'var(--c-ink-3)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        {cfg.services.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--c-ink-3)', margin: '0 0 2px', lineHeight: 1.5 }}>
            Inga {servicePlural.toLowerCase()} än. Lägg till minst en så bokningen har något att boka — du kan
            lämna priset tomt (0 kr) och sätta det senare.
          </p>
        ) : null}
        <Button variant="ghost" icon="plus" onClick={add} style={{ width: 'fit-content' }}>
          Lägg till {serviceWord.toLowerCase()}
        </Button>
      </div>
    </Panel>
  )
}

/** agare — W1-REAL. Ägarens namn → setOwnerName; Ägarens e-post (type=email) →
 *  setOwnerEmail (magic-link invite path). */
function PanelAgare({ cfg, dispatch }: PanelProps) {
  return (
    <Panel
      title="Ägare & inbjudan"
      sub="Ägaren får en magic-link, bekräftar och sätter eget lösenord — och är inne i sin egen admin med rätt roll."
    >
      <div style={{ display: 'grid', gap: 18 }}>
        <Field
          label="Ägarens namn"
          ph="Förnamn Efternamn"
          value={cfg.ownerName}
          onChange={(v) => dispatch({ type: 'setOwnerName', value: v })}
        />
        <Field
          label="Ägarens e-post"
          type="email"
          ph="agare@foretag.se"
          value={cfg.ownerEmail}
          onChange={(v) => dispatch({ type: 'setOwnerEmail', value: v })}
          hint="Får en engångs magic-link-invite vid lansering."
        />
      </div>
    </Panel>
  )
}

/** granska — DISPLAY-ONLY (§9.11). Checklist DERIVED from REAL cfg (stepDone + cfg);
 *  deferred items (tjänster) never read green. "Gå till lansering" → onNext (= live,
 *  the adjacent next step). */
function PanelGranska({ cfg, presets, onNext }: StudioPanelProps) {
  type Item = { label: string; detail: string; done: boolean; optional: boolean; deferred?: boolean }
  const items: Item[] = [
    { label: 'Kundkategori vald', detail: 'Branschtagg för sortering — påverkar inte mall/moduler.', done: !!cfg.branch, optional: false },
    {
      label: 'Namn & subdomän',
      detail: 'Företagsnamn + <slug>.corevo.se.',
      done: !!cfg.name.trim() && !!cfg.slug,
      optional: false,
    },
    { label: 'Temamall', detail: 'Ett byggt storefront-tema.', done: !!cfg.theme, optional: false },
    {
      label: 'Minst en aktiv modul',
      detail: 'Bokning är alltid minst live.',
      done: stepDone('modval', cfg, presets),
      optional: false,
    },
    { label: 'Ägare inbjuden', detail: 'Får magic-link vid lansering.', done: !!cfg.ownerEmail.trim(), optional: true },
    {
      label: 'Tjänster & priser',
      detail: 'Bokningen behöver minst en — kan läggas till senare i admin.',
      done: stepDone('tjanster', cfg, presets),
      optional: true,
    },
  ]
  return (
    <Panel title="Granska checklista" sub="Onboarding-checklistan. Grönt = klart, gult = valfritt/väntar.">
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((c) => {
          const tone = c.done
            ? { bg: 'var(--c-success)', fg: '#fff', icon: 'check' as IconName }
            : c.deferred
              ? { bg: 'var(--c-paper-2)', fg: 'var(--c-ink-3)', icon: 'clock' as IconName }
              : c.optional
                ? { bg: 'var(--c-warning-bg)', fg: 'var(--c-warning)', icon: 'minus' as IconName }
                : { bg: 'var(--c-paper-2)', fg: 'var(--c-ink-3)', icon: 'clock' as IconName }
          return (
            <div
              key={c.label}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: 14,
                border: '1px solid var(--c-line)',
                borderRadius: 12,
                background: 'var(--c-paper)',
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  flex: 'none',
                  borderRadius: 999,
                  background: tone.bg,
                  color: tone.fg,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={tone.icon} size={14} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>
                  {c.label}
                  {c.optional ? <span style={{ color: 'var(--c-ink-3)', fontWeight: 400 }}> · valfritt</span> : null}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)', marginTop: 3, lineHeight: 1.45 }}>{c.detail}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 18 }}>
        <Button variant="primary" icon="arrowRight" onClick={onNext}>
          Gå till lansering
        </Button>
      </div>
    </Panel>
  )
}

/** live — W1-REAL. The single createTenant trigger. Slug card + active-module count;
 *  readiness gate (theme set && a module resolves live — booking floors to live);
 *  gold Lansera (disabled until ready) → onLaunch. The REAL ActionState.success/error
 *  is surfaced by the parent (§9.2: NO fake DB-task theatre here). */
function PanelLive({ cfg, presets, onLaunch }: StudioPanelProps) {
  const activeCount = presets.modules.filter((m) => resolveModuleState(cfg, m.key, presets) !== 'off').length
  // createTenant's only HARD blockers are name + a valid slug (actions.ts). Gate on those
  // + a theme so the gold button never fires a guaranteed-fail submit. booking is force-
  // floored to live in buildCreateTenantFormData, so we don't depend on the catalog read
  // (which fail-softs to [] and would otherwise permanently disable Lansera).
  const ready = !!cfg.name.trim() && !!cfg.slug && !isReservedSlug(cfg.slug) && !!cfg.theme
  return (
    <Panel title="Lansera" sub="Sista steget. Publicerar storefronten på subdomänen och bjuder in ägaren.">
      <div style={{ display: 'grid', gap: 16 }}>
        <Card pad={18} style={{ background: 'var(--c-forest)', color: '#fff', border: 'none' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--c-gold)' }}>
            Publiceras på
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, margin: '8px 0 4px' }}>
            {cfg.slug || 'dinsalong'}.{ROOT}
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-on-forest-2)' }}>
            {activeCount} {activeCount === 1 ? 'modul' : 'moduler'} aktiva · tema {cfg.theme}
          </div>
        </Card>

        {!ready ? (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--c-warning)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              padding: '12px 14px',
              background: 'var(--c-warning-bg)',
              borderRadius: 10,
            }}
          >
            <span style={{ flex: 'none', marginTop: 1 }}>
              <Icon name="alert" size={14} />
            </span>
            Kräver: salongsnamn, en giltig subdomän och ett tema. Komplettera i stegen ovan.
          </div>
        ) : null}

        <div style={{ fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.6 }}>
          Vid lansering skapas allt i ett svep: tenant-rad (status active), inställningar, moduler, ägar-konto + magic-link
          och subdomän-route. Egen domän är parkerat (spärrat tills KÖR).
        </div>

        <Button variant="gold" size="lg" icon="rocket" disabled={!ready} onClick={onLaunch} style={{ justifyContent: 'center', width: '100%' }}>
          Lansera {cfg.name || 'kunden'}
        </Button>
      </div>
    </Panel>
  )
}

/* ════════════════════════════ registry ════════════════════════════ */

/**
 * step id → panel component. Internal to this file + PanelHost (nothing else imports
 * it). Simple panels are typed `FC<PanelProps>` and slot in under parameter
 * contravariance; granska/live take the extra onNext/onLaunch via StudioPanelProps.
 */
export const PANEL_BY_STEP: Record<StepId, FC<StudioPanelProps>> = {
  branch: PanelBranch,
  namn: PanelNamn,
  tema: PanelTema,
  modval: PanelModval,
  modplace: PanelModplace,
  modconf: PanelModconf,
  brand: PanelBrand,
  text: PanelText,
  tjanster: PanelTjanster,
  agare: PanelAgare,
  granska: PanelGranska,
  live: PanelLive,
}
