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
import { type StepId } from '@/lib/platform/onboarding-studio/phases'
import { resolveModuleState, type StudioService } from '@/lib/platform/onboarding-studio/model'
import { modulesForVertical, termPlural, type TemplateOption } from '@/lib/platform/verticals-shared'
import { isReservedSlug } from '@/lib/platform/slug'
import { isSlugTaken } from '@/lib/platform/actions'
import { useEffect, useState } from 'react'
import {
  BOOKING_VARIANTS,
  BOOKING_VARIANT_LABELS,
  BOOKING_VARIANT_TAGS,
  BOOKING_VARIANT_DESCRIPTIONS,
  RECOMMENDED_BOOKING_VARIANT,
} from '@/lib/platform/booking-variant'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'
import { ThemeGallery } from '@/components/platform/ThemeGallery'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

/**
 * The prop bag every panel in the registry receives. Extends the frozen PanelProps
 * (cfg/dispatch/presets) with the two callbacks the special panels need:
 *   • onNext   — kept in the contract for panels that want an in-body advance
 *                (currently unused — granska merged into live 2026-07-11).
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

/** Ikon per bransch-nyckel (fallback 'building'). Korten kommer från DB
 *  (presets.verticals) — en ny rad i verticals-tabellen dyker upp här av sig själv. */
const BRANSCH_ICONS: Record<string, IconName> = {
  generell: 'layers',
  'frisör': 'scissors',
  frisor: 'scissors',
  barbershop: 'scissors',
  nagelstudio: 'building',
  restaurang: 'coffee',
  florist: 'sun',
  klinik: 'shield',
}

/** branch — kort per RIKTIG bransch (DB verticals, inga roadmap-stubbar). Valet
 *  FÖRFYLLER mall + moduler + ord från bransch-förvalen (/branscher äger dem);
 *  allt går att ändra i stegen efter. */
function PanelBranch({ cfg, dispatch, presets }: PanelProps) {
  return (
    <Panel
      title="Vilken bransch?"
      sub="Valet förfyller mall, moduler och ord enligt branschens förval — du kan ändra allt i stegen efter. Branschens förval styr du under Branscher."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {presets.verticals.map((b) => {
          const on = cfg.branch === b.key
          const staffWord = b.terminology?.staff ?? 'Personal'
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
                <Icon name={BRANSCH_ICONS[b.key] ?? 'building'} size={19} />
              </span>
              <span style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 13.5, color: 'var(--c-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--c-ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {staffWord}
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
  // Inline upptagen-koll (Dunder-fix): debounce → isSlugTaken-servern. Tidigare
  // small en dubblettslug först vid Lansera. Kollen är rådgivande — createTenant
  // äger fortfarande den auktoritativa unikhets-spärren.
  const [taken, setTaken] = useState(false)
  useEffect(() => {
    setTaken(false)
    if (!cfg.slug || reserved) return
    const t = setTimeout(() => {
      isSlugTaken(cfg.slug).then(setTaken).catch(() => {})
    }, 450)
    return () => clearTimeout(t)
  }, [cfg.slug, reserved])
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
          ) : taken ? (
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
              <Icon name="alert" size={14} /> &quot;{cfg.slug}&quot; är redan tagen av en annan kund — välj en annan.
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
  // ALLTID de riktiga temana — vendor-mallarna ur templatesByVertical valde tidigare
  // orenderbara nycklar (tyst fallback, "tema-steget är trasigt per bransch").
  // goal-58: sviten är 20 mallar → ThemeGallery (kategori-flikar + taggar + sök + kort
  // med mallens hero-bild), SAMMA komponent som kundkortets Sida-flik använder.
  // Branschen förfyller sitt default-tema, så steget går att passera med Nästa.
  const branschDefault = cfg.branch
    ? presets.verticals.find((v) => v.key === cfg.branch)?.defaultTemplate ?? null
    : null
  return (
    <Panel
      title="Välj mall"
      sub="Branschens mall är redan vald — byt bara om du vill. Förhandsvisningen till höger visar kundens riktiga startsida."
    >
      <ThemeGallery
        value={cfg.theme}
        defaultKey={branschDefault}
        compact
        onChange={(key) => dispatch({ type: 'setTheme', key })}
      />
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
      title="Moduler"
      sub="Förvalda enligt branschen — redan rätt för de flesta. Ändra fritt om kunden behöver något extra. Bokning är alltid minst live."
    >
      <div style={{ ...groupEyebrow, color: 'var(--c-gold-600)', marginBottom: 10 }}>Branschens förval</div>
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

/* modplace + modconf borttagna 2026-07-11 (Dunder-fix): stubbar utan skrivväg
   mitt i flödet — logga-uppladdning och modulinställningar bor i kundkortet. */

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

/** live — «Granska & lansera» (granska+live ihopslagna 2026-07-11, UX-order): kompakt
 *  checklista härledd ur REAL cfg + «vad kunden får»-kortet + den enda createTenant-
 *  triggern. Gold Lansera (disabled tills klart) → onLaunch; ActionState ytas av parent. */
function PanelLive({ cfg, presets, onLaunch }: StudioPanelProps) {
  const activeModules = presets.modules.filter((m) => resolveModuleState(cfg, m.key, presets) !== 'off')
  const activeCount = activeModules.length
  const namedServices = cfg.services.filter((s) => s.name.trim() !== '')
  const checks: { label: string; done: boolean; optional?: boolean }[] = [
    { label: 'Bransch vald', done: !!cfg.branch },
    { label: 'Namn & subdomän', done: !!cfg.name.trim() && !!cfg.slug },
    { label: 'Temamall', done: !!cfg.theme },
    { label: `Minst en tjänst (${namedServices.length} tillagda)`, done: namedServices.length > 0 },
    { label: 'Ägare inbjuds via mail', done: !!cfg.ownerEmail.trim(), optional: true },
  ]
  // createTenant's only HARD blockers are name + a valid slug (actions.ts). Gate on those
  // + a theme so the gold button never fires a guaranteed-fail submit. booking is force-
  // floored to live in buildCreateTenantFormData, so we don't depend on the catalog read
  // (which fail-softs to [] and would otherwise permanently disable Lansera).
  // + minst en namngiven tjänst (Dunder-fix): bokningsmodulen golvas till live,
  // så en salong utan tjänster lanserades tidigare med en bokning som inte har
  // något att boka. Tjänsterna läggs i steget «Tjänster & innehåll».
  const hasService = namedServices.length > 0
  const ready =
    !!cfg.name.trim() && !!cfg.slug && !isReservedSlug(cfg.slug) && !!cfg.theme && hasService
  return (
    <Panel title="Granska & lansera" sub="Sista koll — exakt det här får kunden. Sen live på subdomänen.">
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Kompakt checklista (ersätter det egna granska-steget) */}
        <div style={{ display: 'grid', gap: 6 }}>
          {checks.map((c) => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--c-ink)' }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  flex: 'none',
                  borderRadius: 999,
                  background: c.done ? 'var(--c-success)' : c.optional ? 'var(--c-warning-bg)' : 'var(--c-paper-2)',
                  color: c.done ? '#fff' : c.optional ? 'var(--c-warning)' : 'var(--c-ink-3)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={c.done ? 'check' : c.optional ? 'minus' : 'clock'} size={12} />
              </span>
              <span style={{ fontWeight: c.done ? 500 : 600 }}>
                {c.label}
                {c.optional && !c.done ? <span style={{ color: 'var(--c-ink-3)', fontWeight: 400 }}> · valfritt</span> : null}
              </span>
            </div>
          ))}
        </div>

        {/* Vad kunden får */}
        <Card pad={18} style={{ background: 'var(--c-forest)', color: '#fff', border: 'none' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--c-gold)' }}>
            Kunden får
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, margin: '8px 0 4px' }}>
            {cfg.slug || 'dinsalong'}.{ROOT}
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-on-forest-2)', lineHeight: 1.6 }}>
            Tema <b style={{ color: '#fff' }}>{cfg.theme}</b> · {activeCount}{' '}
            {activeCount === 1 ? 'modul' : 'moduler'}:{' '}
            {activeModules.map((m) => m.name).join(', ') || '—'}
            <br />
            {namedServices.length} {namedServices.length === 1 ? 'tjänst' : 'tjänster'} redo att bokas
            {cfg.ownerEmail.trim() ? <> · ägar-inbjudan till {cfg.ownerEmail.trim()}</> : null}
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
            Kräver: salongsnamn, en giltig subdomän, ett tema och minst en tjänst. Komplettera i
            stegen ovan.
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
  agare: PanelAgare,
  live: PanelLive,
}
