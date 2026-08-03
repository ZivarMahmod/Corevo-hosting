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
import { normalizeBookingExternalUrl } from '@/lib/platform/booking-external-url'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'
import { ThemeGallery } from '@/components/platform/ThemeGallery'
import { studioBranchName, studioPlaceholderSlug } from './studio-placeholder'
import { TENANT_HOST_SUFFIX, tenantStorefrontHost } from '@/lib/storefront-url'

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
  off: 'Av och dold för kunden.',
  live: 'På och synlig för kunden.',
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
                  background: on ? 'var(--c-forest-fill, var(--c-forest))' : 'var(--c-paper-2)',
                  color: on ? 'var(--c-on-forest, #fff)' : 'var(--c-forest)',
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
                dispatch({ type: 'setSlug', value: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
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
              .{TENANT_HOST_SUFFIX}
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
              <Icon name="alert" size={14} /> &quot;{cfg.slug}&quot; är reserverad — kan inte bli en subdomän.
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

/** tema — mall-väljaren. */
function PanelTema({ cfg, dispatch, presets }: PanelProps) {
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

/** Module visibility only. Booking provider and presentation live in the next step. */
function PanelModval({ cfg, dispatch, presets }: PanelProps) {
  const options = modulesForVertical(presets, cfg.branch)
  const rec = options.filter((m) => m.defaultState !== 'off')
  const others = options.filter((m) => m.defaultState === 'off')

  // A render function (not a nested component) so the rows don't churn identity.
  const renderRow = (moduleKey: string, name: string) => {
    const isBooking = moduleKey === 'booking'
    const cur = resolveModuleState(cfg, moduleKey, presets)
    const choices: ModuleState[] = [...MODULE_STATES]
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
        <ModuleStatePills label={`${name} På eller Av`} value={cur} choices={choices} onChange={(state) => dispatch({ type: 'setModule', key: moduleKey, state })} />
        <p style={{ fontSize: 12, color: 'var(--c-ink-3)', lineHeight: 1.5, margin: '8px 0 0' }}>
          {MODULE_STATE_HINTS[cur]}
        </p>
      </div>
    )
  }

  return (
    <Panel
      title="Moduler"
      sub="Förvalda enligt branschen — redan rätt för de flesta. Ändra fritt om kunden behöver något extra."
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

function PanelBokning({ cfg, dispatch, presets }: PanelProps) {
  const state = resolveModuleState(cfg, 'booking', presets)
  const live = state === 'live'
  const externalValid = normalizeBookingExternalUrl(cfg.bookingExternalUrl) !== null

  return (
    <Panel
      title="Bokning"
      sub="Först styr På eller Av om bokning syns. När den är På väljer du Corevo eller en extern bokningstjänst."
    >
      <div style={{ display: 'grid', gap: 18 }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Bokningsmodul</div>
          <ModuleStatePills
            label="Bokningsmodul På eller Av"
            value={state}
            choices={[...MODULE_STATES]}
            onChange={(next) => dispatch({ type: 'setModule', key: 'booking', state: next })}
          />
          <p style={{ fontSize: 12, color: 'var(--c-ink-3)', lineHeight: 1.5, margin: '8px 0 0' }}>
            {MODULE_STATE_HINTS[state]}
          </p>
        </div>

        {live ? <>
          <div role="radiogroup" aria-label="Bokningsleverantör" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              ['corevo', 'Corevo-bokning', 'Kunden bokar direkt på sin Corevo-sida.'],
              ['external', 'Extern bokning', 'Boka-knapparna öppnar exempelvis Bokadirekt.'],
            ] as const).map(([provider, label, description]) => {
              const selected = cfg.bookingProvider === provider
              return (
                <button
                  key={provider}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => dispatch({ type: 'setBookingProvider', provider })}
                  style={{
                    textAlign: 'left',
                    padding: 14,
                    border: `2px solid ${selected ? 'var(--c-forest)' : 'var(--c-line)'}`,
                    borderRadius: 10,
                    background: selected ? 'var(--c-paper-2)' : 'var(--c-paper)',
                    color: 'var(--c-ink)',
                    cursor: 'pointer',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: 14 }}>{label}</strong>
                  <span style={{ display: 'block', marginTop: 5, color: 'var(--c-ink-3)', fontSize: 12, lineHeight: 1.45 }}>
                    {description}
                  </span>
                </button>
              )
            })}
          </div>

          {cfg.bookingProvider === 'external' ? (
            <Field
              label="Extern bokningslänk"
              type="url"
              required
              ph="https://www.bokadirekt.se/..."
              value={cfg.bookingExternalUrl}
              onChange={(value) => dispatch({ type: 'setBookingExternalUrl', value })}
              hint={cfg.bookingExternalUrl ? undefined : 'Alla Boka-knappar använder den här länken från start.'}
              error={cfg.bookingExternalUrl && !externalValid ? 'Ange en fullständig https-länk.' : undefined}
            />
          ) : (
            <div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Bokningssätt</div>
              <div role="radiogroup" aria-label="Bokningssätt" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {BOOKING_VARIANTS.map((variant) => {
                  const selected = cfg.variant === variant
                  return (
                    <button
                      key={variant}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => dispatch({ type: 'setVariant', variant })}
                      style={{
                        textAlign: 'left',
                        padding: 12,
                        border: `2px solid ${selected ? 'var(--c-forest)' : 'var(--c-line)'}`,
                        borderRadius: 10,
                        background: selected ? 'var(--c-paper-2)' : 'var(--c-paper)',
                        color: 'var(--c-ink)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{BOOKING_VARIANT_LABELS[variant]}</strong>
                        {variant === RECOMMENDED_BOOKING_VARIANT ? <Badge tone="gold" dot={false}>Rek.</Badge> : (
                          <small>{BOOKING_VARIANT_TAGS[variant]}</small>
                        )}
                      </span>
                      <span style={{ display: 'block', marginTop: 5, color: 'var(--c-ink-3)', fontSize: 12, lineHeight: 1.45 }}>
                        {BOOKING_VARIANT_DESCRIPTIONS[variant]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </> : (
          <div style={{ padding: 14, border: '1px solid var(--c-line)', borderRadius: 10, background: 'var(--c-paper)' }}>
            <strong style={{ display: 'block', color: 'var(--c-ink)' }}>Inga bokningsknappar visas</strong>
            <span style={{ display: 'block', marginTop: 5, color: 'var(--c-ink-3)', fontSize: 12.5 }}>
              Leverantören kan väljas senare när modulen slås på.
            </span>
          </div>
        )}
      </div>
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
          required
          ph="agare@foretag.se"
          value={cfg.ownerEmail}
          onChange={(v) => dispatch({ type: 'setOwnerEmail', value: v })}
          hint="Får en engångs magic-link-invite när kunden skapas."
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
  const bookingLive = resolveModuleState(cfg, 'booking', presets) === 'live'
  const bookingReady = !bookingLive
    || cfg.bookingProvider === 'corevo'
    || normalizeBookingExternalUrl(cfg.bookingExternalUrl) !== null
  const checks: { label: string; done: boolean; optional?: boolean }[] = [
    { label: 'Bransch vald', done: !!cfg.branch },
    { label: 'Namn & subdomän', done: !!cfg.name.trim() && !!cfg.slug },
    { label: 'Temamall', done: !!cfg.theme },
    {
      label: bookingLive
        ? cfg.bookingProvider === 'external' ? 'Extern bokningslänk' : 'Corevo-bokning'
        : 'Bokning är Av',
      done: bookingReady,
    },
    { label: `Tjänster (${namedServices.length} tillagda — läggs i adminen)`, done: namedServices.length > 0, optional: true },
    { label: 'Ägare inbjuds via e-post', done: !!cfg.ownerEmail.trim() },
  ]
  // Mirror createTenant's owner/name/slug requirements + a theme so the gold button
  // never fires a guaranteed-fail submit. Unset booking
  // floors to live in buildCreateTenantFormData, so we don't depend on the catalog read
  // (which fail-softs to [] and would otherwise permanently disable Lansera).
  // Tjänststeget togs bort 2026-07-11 (onboardingen ska vara superlätt att komma
  // igång — tjänster läggs i kundens admin EFTER lansering). Grinden krävde ändå
  // en namngiven tjänst men inget steg fanns att lägga den i → Lansera var
  // permanent disabled. Kravet är nu rådgivande (checklistan visar antalet), och
  // createTenants riktiga hard-blockers (namn + giltig slug + tema + ägare) gatar knappen.
  const ready =
    !!cfg.name.trim()
    && !!cfg.slug
    && !isReservedSlug(cfg.slug)
    && !!cfg.theme
    && !!cfg.ownerEmail.trim()
    && bookingReady
  return (
    <Panel title="Granska & skapa" sub="Sista koll — kunden skapas under konfiguration och publiceras från kundkortet.">
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
        <Card pad={18} style={{ background: 'var(--c-forest-fill, var(--c-forest))', color: 'var(--c-on-forest, #fff)', border: 'none' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--c-gold)' }}>
            Kunden får
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, margin: '8px 0 4px' }}>
            {tenantStorefrontHost(
              cfg.slug || studioPlaceholderSlug(studioBranchName(presets.verticals, cfg.branch)),
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-on-forest-2)', lineHeight: 1.6 }}>
            Tema <b style={{ color: 'var(--c-on-forest, #fff)' }}>{cfg.theme}</b> · {activeCount}{' '}
            {activeCount === 1 ? 'modul' : 'moduler'}:{' '}
            {activeModules.map((m) => m.name).join(', ') || '—'}
            <br />
            Bokning: {bookingLive ? cfg.bookingProvider === 'external' ? 'extern länk' : 'Corevo' : 'Av'}
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
            Kräver: företagsnamn, en giltig subdomän, ett tema, ägarens e-post
            {bookingLive && cfg.bookingProvider === 'external' ? ' och en giltig extern bokningslänk' : ''}.
            Komplettera i stegen ovan.
          </div>
        ) : null}

        <div style={{ fontSize: 12.5, color: 'var(--c-ink-2)', lineHeight: 1.6 }}>
          Nu skapas tenant, inställningar, moduler och ägarkonto i status
          <b> Under konfiguration</b>. Den isolerade standardadressen är reserverad,
          men öppnas först när kundkortets DB-kontroll är grön och du publicerar.
        </div>

        <Button variant="gold" size="lg" icon="rocket" disabled={!ready} onClick={onLaunch} style={{ justifyContent: 'center', width: '100%' }}>
          Skapa {cfg.name || 'kunden'}
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
  bokning: PanelBokning,
  agare: PanelAgare,
  live: PanelLive,
}
